import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';

// Correct CommonJS imports
import colyseusPkg from 'colyseus';
const { Server: ColyseusServer, Room, matchMaker } = colyseusPkg;

import wsTransportPkg from '@colyseus/ws-transport';
const { WebSocketTransport } = wsTransportPkg;

export const config = {
  api: {
    bodyParser: false,
  },
};

// ---------- Embedded Game Room ----------
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
    gameServer.define('game', GenericGameRoom);
    console.log('Colyseus server initialized');
  }
  return gameServer;
}

// ---------- Main API Handler ----------
export default async function handler(req, res) {
  try {
    // Ensure Colyseus server is initialized (defines room types)
    getGameServer();

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
        console.error('Failed to fetch games:', error);
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

      const { error: uploadError } = await supabase.storage
        .from('game-zips')
        .upload(fileName, fileContent, {
          contentType: 'application/zip',
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('Upload failed:', uploadError);
        return res.status(500).json({ error: 'Upload failed' });
      }

      const { data: urlData } = supabase.storage
        .from('game-zips')
        .getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      const { data: gameData, error: gameError } = await supabase
        .from('user_games')
        .insert({ name: gameName, description, storage_path: publicUrl })
        .select()
        .single();

      if (gameError) {
        console.error('Database insert failed:', gameError);
        return res.status(500).json({ error: 'Database insert failed' });
      }

      if (multiplayer) {
        const { error: metaError } = await supabase
          .from('game_metadata')
          .insert({
            game_id: gameData.id,
            multiplayer: true,
            max_players: maxPlayers,
            active_rooms: 0,
          });
        if (metaError) console.error('Failed to insert game_metadata:', metaError);
      }

      const { data: tokenData, error: tokenError } = await supabase
        .from('game_tokens')
        .insert({ game_id: gameData.id, permissions: ['read', 'write'] })
        .select()
        .single();

      if (tokenError) {
        console.error('Token generation failed:', tokenError);
        return res.status(201).json({ id: gameData.id, token: null });
      }

      return res.status(200).json({
        id: gameData.id,
        token: tokenData.token,
        url: publicUrl,
        multiplayer
      });
    }

    // ----- Multiplayer Room Management (using matchMaker directly) -----
    if (req.method === 'POST' && req.query.action === 'createRoom') {
      const { gameId, roomName } = req.body;
      if (!gameId || !roomName) {
        return res.status(400).json({ error: 'gameId and roomName required' });
      }

      const { data: meta, error: metaError } = await supabase
        .from('game_metadata')
        .select('*')
        .eq('game_id', gameId)
        .single();

      if (metaError || !meta?.multiplayer) {
        return res.status(400).json({ error: 'Game does not support multiplayer' });
      }

      try {
        const room = await matchMaker.createRoom('game', {
          gameId,
          roomName,
          maxClients: meta.max_players,
        });

        await supabase
          .from('game_metadata')
          .update({ active_rooms: meta.active_rooms + 1 })
          .eq('game_id', gameId);

        return res.status(200).json({ roomId: room.roomId });
      } catch (err) {
        console.error('Failed to create room:', err);
        return res.status(500).json({ error: 'Failed to create room: ' + err.message });
      }
    }

    if (req.method === 'GET' && req.query.action === 'listRooms') {
      const gameId = req.query.gameId;
      if (!gameId) return res.status(400).json({ error: 'gameId required' });

      try {
        const rooms = await matchMaker.query({ gameId });
        return res.status(200).json(rooms);
      } catch (err) {
        console.error('Failed to list rooms:', err);
        return res.status(500).json({ error: 'Failed to list rooms: ' + err.message });
      }
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Unhandled error in API handler:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
}
