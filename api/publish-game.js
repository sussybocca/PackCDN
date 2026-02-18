import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';
import { Server as ColyseusServer, Room } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';

export const config = {
  api: {
    bodyParser: false,
  },
};

// ---------- Embedded Game Room (no separate file needed) ----------
class GenericGameRoom extends Room {
  onCreate(options) {
    console.log('GenericGameRoom created:', options);
    this.roomId = options.roomId;
    this.gameId = options.gameId;
    this.maxClients = options.maxClients || 4;

    this.setState({
      players: {},
      messages: []
    });

    this.onMessage('move', (client, data) => {
      // Example: handle player movement
      this.state.players[client.sessionId] = data;
      this.broadcast('state', this.state);
    });

    this.onMessage('chat', (client, message) => {
      this.state.messages.push({ from: client.sessionId, text: message });
      this.broadcast('chat', this.state.messages.slice(-5));
    });
  }

  onJoin(client, options) {
    console.log('Client joined:', client.sessionId);
    this.state.players[client.sessionId] = { x: 0, y: 0 };
  }

  onLeave(client, consented) {
    delete this.state.players[client.sessionId];
  }
}

// ---------- Singleton Colyseus Server ----------
let gameServer = null;

function getGameServer() {
  if (!gameServer) {
    gameServer = new ColyseusServer({
      transport: new WebSocketTransport()
    });

    // Define the generic room – will be used for all multiplayer games
    gameServer.define('game', GenericGameRoom);
    console.log('Colyseus server initialized');
  }
  return gameServer;
}

// ---------- Main API Handler ----------
export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars');
    return res.status(500).json({ error: 'Server configuration error' });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  // ----- WebSocket Upgrade (for Colyseus) -----
  if (req.headers.upgrade?.toLowerCase() === 'websocket') {
    const server = getGameServer();
    // @ts-ignore – Vercel exposes raw socket via req.socket
    return server.transport.onRequest(req, res);
  }

  // ----- REST: GET (list published games) -----
  if (req.method === 'GET' && !req.query.action) {
    const { data, error } = await supabase
      .from('user_games')
      .select('id, name, description, storage_path, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to fetch games' });
    }
    return res.status(200).json(data);
  }

  // ----- REST: POST (publish new game) -----
  if (req.method === 'POST' && !req.query.action) {
    const form = formidable({ multiples: false });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const gameName = fields.name?.[0] || fields.name || 'Unnamed';
    const description = fields.description?.[0] || fields.description || '';
    const multiplayer = fields.multiplayer?.[0] === 'true' || false;
    const maxPlayers = parseInt(fields.maxPlayers?.[0] || '4', 10);
    const file = files.file?.[0] || files.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileContent = fs.readFileSync(file.filepath);
    const safeName = gameName.replace(/[^a-z0-9]/gi, '_');
    const fileName = `${Date.now()}-${safeName}.zip`;

    // Upload to Supabase
    const { error: uploadError } = await supabase.storage
      .from('game-zips')
      .upload(fileName, fileContent, {
        contentType: 'application/zip',
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error(uploadError);
      return res.status(500).json({ error: 'Upload failed' });
    }

    const { data: urlData } = supabase.storage
      .from('game-zips')
      .getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    // Insert game metadata
    const { data: gameData, error: gameError } = await supabase
      .from('user_games')
      .insert({ name: gameName, description, storage_path: publicUrl })
      .select()
      .single();

    if (gameError) {
      console.error(gameError);
      return res.status(500).json({ error: 'Database insert failed' });
    }

    // If multiplayer, insert into game_metadata table (create it if not exists)
    if (multiplayer) {
      // Create table if needed (run this SQL separately)
      await supabase
        .from('game_metadata')
        .insert({
          game_id: gameData.id,
          multiplayer: true,
          max_players: maxPlayers,
          active_rooms: 0,
        });
    }

    // Generate edit token
    const { data: tokenData, error: tokenError } = await supabase
      .from('game_tokens')
      .insert({ game_id: gameData.id, permissions: ['read', 'write'] })
      .select()
      .single();

    if (tokenError) {
      console.error(tokenError);
      return res.status(201).json({ id: gameData.id, token: null });
    }

    return res.status(200).json({
      id: gameData.id,
      token: tokenData.token,
      url: publicUrl,
      multiplayer
    });
  }

  // ----- Multiplayer Room Management -----
  const server = getGameServer();

  // POST /api/publish-game?action=createRoom
  if (req.method === 'POST' && req.query.action === 'createRoom') {
    const { gameId, roomName } = req.body;
    if (!gameId || !roomName) {
      return res.status(400).json({ error: 'gameId and roomName required' });
    }

    // Fetch game metadata
    const { data: meta, error: metaError } = await supabase
      .from('game_metadata')
      .select('*')
      .eq('game_id', gameId)
      .single();

    if (metaError || !meta?.multiplayer) {
      return res.status(400).json({ error: 'Game does not support multiplayer' });
    }

    try {
      const room = await server.matchMaker.createRoom('game', {
        gameId,
        roomName,
        maxClients: meta.max_players,
      });

      // Increment active_rooms counter
      await supabase
        .from('game_metadata')
        .update({ active_rooms: meta.active_rooms + 1 })
        .eq('game_id', gameId);

      return res.status(200).json({ roomId: room.roomId });
    } catch (err) {
      console.error('Failed to create room:', err);
      return res.status(500).json({ error: 'Failed to create room' });
    }
  }

  // GET /api/publish-game?action=listRooms&gameId=xxx
  if (req.method === 'GET' && req.query.action === 'listRooms') {
    const gameId = req.query.gameId;
    if (!gameId) return res.status(400).json({ error: 'gameId required' });

    try {
      // Query all rooms of type 'game' (you can filter by metadata)
      const rooms = await server.matchMaker.query({ gameId });
      return res.status(200).json(rooms);
    } catch (err) {
      console.error('Failed to list rooms:', err);
      return res.status(500).json({ error: 'Failed to list rooms' });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
