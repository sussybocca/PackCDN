import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false, // required for formidable
  },
};

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars');
    return res.status(500).json({ error: 'Server configuration error' });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  // ----- GET: List all games -----
  if (req.method === 'GET') {
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

  // ----- POST: Publish a new game -----
  if (req.method === 'POST') {
    // Parse multipart form
    const form = formidable({ multiples: false });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const gameName = fields.name?.[0] || fields.name || 'Unnamed';
    const description = fields.description?.[0] || fields.description || '';
    const file = files.file?.[0] || files.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Read the uploaded file (Vercel allows fs on /tmp)
    const fileContent = fs.readFileSync(file.filepath);

    // Generate a safe filename
    const safeName = gameName.replace(/[^a-z0-9]/gi, '_');
    const fileName = `${Date.now()}-${safeName}.zip`;

    // Upload to Supabase Storage
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

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('game-zips')
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    // Insert into user_games
    const { data: gameData, error: gameError } = await supabase
      .from('user_games')
      .insert({ name: gameName, description, storage_path: publicUrl })
      .select()
      .single();

    if (gameError) {
      console.error(gameError);
      return res.status(500).json({ error: 'Database insert failed' });
    }

    // Generate token for editing
    const { data: tokenData, error: tokenError } = await supabase
      .from('game_tokens')
      .insert({ game_id: gameData.id, permissions: ['read', 'write'] })
      .select()
      .single();

    if (tokenError) {
      console.error(tokenError);
      // Still return game but no token
      return res.status(201).json({ id: gameData.id, token: null });
    }

    res.status(200).json({ id: gameData.id, token: tokenData.token, url: publicUrl });
  }

  // If method not allowed
  res.status(405).json({ error: 'Method not allowed' });
}
