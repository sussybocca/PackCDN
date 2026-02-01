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
    // Parse packJson to access its properties
    const packJsonObj = JSON.parse(packJson);
    
    // Generate URL-friendly ID (not for database, just for URLs)
    const urlId = generateUrlId();
    const cdnUrl = `https://packcdn.firefly-worker.workers.dev/cdn/${urlId}`;
    const workerUrl = `https://packcdn.firefly-worker.workers.dev/pack/${urlId}`;
    
    // Encrypt for private packages
    const encryptedKey = !isPublic ? generateEncryptionKey() : null;

    // Map frontend package types to valid database package types
    let packageType = 'npm';
    
    if (packJsonObj.type) {
      const typeMap = {
        'module': 'npm',
        'library': 'npm', 
        'template': 'npm',
        'plugin': 'npm',
        'python': 'python',
        'wasm': 'wasm'
      };
      
      const frontendType = packJsonObj.type.toLowerCase();
      packageType = typeMap[frontendType] || 'npm';
    }

    // Save to Supabase - DON'T include id field, let Supabase generate UUID
    const { data, error } = await supabase
      .from('packs')
      .insert([{
        // No id field - Supabase will auto-generate UUID
        name,
        pack_json: packJson,
        files,
        cdn_url: cdnUrl,
        worker_url: workerUrl,
        encrypted_key: encryptedKey,
        is_public: isPublic,
        package_type: packageType
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      packId: data.id, // Use the auto-generated UUID from Supabase
      cdnUrl,
      workerUrl,
      installCommand: `pack install ${name} ${cdnUrl}`,
      encryptedKey
    });
  } catch (error) {
    console.error('Publish error:', error);
    res.status(500).json({ error: 'Publish failed: ' + error.message });
  }
}

function generateUrlId() {
  return Math.random().toString(36).substring(2) + 
         Date.now().toString(36);
}

function generateEncryptionKey() {
  return Buffer.from(
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  ).toString('base64');
}
