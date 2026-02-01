// /api/publish.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, packJson, files, isPublic = true } = req.body;

  try {
    // Generate unique IDs and URLs
    const packId = generateId();
    const cdnUrl = `https://packcdn.firefly-worker.workers.dev/cdn/${packId}`;
    const workerUrl = `https://packcdn.firefly-worker.workers.dev/pack/${packId}`;
    
    // Encrypt for private packages
    const encryptedKey = !isPublic ? generateEncryptionKey() : null;

    // Save to Supabase
    const { data, error } = await supabase
      .from('packs')
      .insert([{
        id: packId,
        name,
        pack_json: packJson,
        files,
        cdn_url: cdnUrl,
        worker_url: workerUrl,
        encrypted_key: encryptedKey,
        is_public: isPublic,
        package_type: packJson.type
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      packId,
      cdnUrl,
      workerUrl,
      installCommand: `pack install ${name} ${cdnUrl}`,
      encryptedKey
    });
  } catch (error) {
    res.status(500).json({ error: 'Publish failed' });
  }
}

function generateId() {
  return Math.random().toString(36).substring(2) + 
         Date.now().toString(36);
}

function generateEncryptionKey() {
  return Buffer.from(
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  ).toString('base64');
}
