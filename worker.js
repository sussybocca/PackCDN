// Cloudflare Worker - packcdn.workers.dev
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route handlers
    if (path.startsWith('/cdn/')) {
      return handleCDN(request, path);
    } else if (path.startsWith('/pack/')) {
      return handlePackInfo(request, path);
    } else if (path.startsWith('/install/')) {
      return handleInstall(request, path);
    } else if (path === '/') {
      return handleHome();
    }

    return new Response('Not Found', { 
      status: 404,
      headers: corsHeaders
    });
  }
};

// Handle CDN file serving
async function handleCDN(request, path) {
  const packId = path.split('/')[2];
  const filePath = path.split('/').slice(3).join('/') || 'index.js';
  
  // Fetch pack from Vercel API (via Supabase)
  const response = await fetch(
    `https://pack-cdn.vercel.app/api/get-pack?id=${packId}`,
    {
      headers: { 'Origin': request.headers.get('origin') || '*' }
    }
  );
  
  if (!response.ok) {
    return new Response('Pack not found', { status: 404 });
  }
  
  const pack = await response.json();
  const file = pack.files.find(f => f.path === filePath);
  
  if (!file) {
    return new Response('File not found', { status: 404 });
  }
  
  // Determine content type
  let contentType = 'text/plain';
  if (file.path.endsWith('.js')) contentType = 'application/javascript';
  if (file.path.endsWith('.py')) contentType = 'text/x-python';
  if (file.path.endsWith('.wasm')) contentType = 'application/wasm';
  if (file.path.endsWith('.json')) contentType = 'application/json';
  
  return new Response(file.content, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// Handle pack information page (HTML)
async function handlePackInfo(request, path) {
  const packId = path.split('/')[2];
  
  // Fetch pack data
  const response = await fetch(
    `https://pack-cdn.vercel.app/api/get-pack?id=${packId}`
  );
  
  if (!response.ok) {
    return renderNotFound();
  }
  
  const pack = await response.json();
  
  // Generate HTML page for this pack
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${pack.name} - PackCDN</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; border-radius: 10px; margin-bottom: 2rem; }
        .badge { background: #4CAF50; color: white; padding: 4px 12px; border-radius: 20px; font-size: 14px; }
        .code { background: #f5f5f5; padding: 1rem; border-radius: 5px; font-family: monospace; overflow-x: auto; }
        .install-box { background: #1a1a1a; color: #00ff9d; padding: 1rem; border-radius: 5px; font-family: monospace; }
        .files { margin-top: 2rem; }
        .file-item { padding: 10px; border-bottom: 1px solid #eee; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${pack.name}</h1>
        <p>v${pack.version} • ${pack.package_type} • ${pack.downloads} downloads</p>
        <span class="badge">${pack.is_public ? 'Public' : 'Private'}</span>
      </div>
      
      <div class="install-box">
        $ pack install ${pack.name} ${pack.cdn_url}
      </div>
      
      <h3>Usage</h3>
      <div class="code">
        // JavaScript<br>
        import pkg from '${pack.cdn_url}/index.js';<br><br>
        // HTML<br>
        &lt;script src="${pack.cdn_url}/index.js"&gt;&lt;/script&gt;
      </div>
      
      ${pack.pack_json.description ? `<h3>Description</h3><p>${pack.pack_json.description}</p>` : ''}
      
      <div class="files">
        <h3>Files</h3>
        ${pack.files.map(file => `
          <div class="file-item">
            <strong>${file.path}</strong>
            ${file.isEntry ? '<span class="badge">Entry</span>' : ''}
          </div>
        `).join('')}
      </div>
      
      <div style="margin-top: 2rem; color: #666;">
        <p>Pack ID: ${pack.id}</p>
        <p>Created: ${new Date(pack.created_at).toLocaleDateString()}</p>
        <p>CDN URL: <a href="${pack.cdn_url}">${pack.cdn_url}</a></p>
      </div>
      
      <script>
        // Track views
        fetch('https://pack-cdn.vercel.app/api/track-view?id=${pack.id}', { method: 'POST' });
      </script>
    </body>
    </html>
  `;
  
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// Handle pack install script
async function handleInstall(request, path) {
  const packName = path.split('/')[2];
  
  const installScript = `
#!/bin/bash
# PackCDN Installer for ${packName}

echo "Installing ${packName} from PackCDN..."
PACK_URL="https://packcdn.workers.dev/cdn/${packName}"

# Download pack.json
curl -s $PACK_URL/pack.json > pack.json

# Parse and download files
python3 -c "
import json, os, requests
with open('pack.json') as f:
    data = json.load(f)
    
for file in data['files']:
    dirname = os.path.dirname(file['path'])
    if dirname and not os.path.exists(dirname):
        os.makedirs(dirname)
    
    response = requests.get('$PACK_URL/' + file['path'])
    with open(file['path'], 'wb') as f:
        f.write(response.content)
    
    print('Downloaded:', file['path'])
"

echo "Installation complete!"
echo "Run: node index.js"  # or python main.py depending on type
  `;
  
  return new Response(installScript, {
    headers: {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function handleHome() {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>PackCDN - Custom Package CDN</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 50px; }
        h1 { color: #667eea; }
        .cta { background: #667eea; color: white; padding: 15px 30px; border-radius: 5px; text-decoration: none; display: inline-block; margin: 20px; }
        .features { display: flex; justify-content: center; gap: 30px; margin-top: 50px; }
        .feature { max-width: 300px; }
      </style>
    </head>
    <body>
      <h1>🚀 PackCDN</h1>
      <p>Create, publish, and share custom packages instantly</p>
      <a href="https://your-vercel-app.vercel.app/editor.html" class="cta">Create a Pack</a>
      <a href="https://your-vercel-app.vercel.app/explore.html" class="cta">Explore Packs</a>
      
      <div class="features">
        <div class="feature">
          <h3>📦 NPM Packages</h3>
          <p>Create and publish JavaScript/TypeScript packages</p>
        </div>
        <div class="feature">
          <h3>🐍 Python Modules</h3>
          <p>Share Python code as importable modules</p>
        </div>
        <div class="feature">
          <h3>⚡ WASM Modules</h3>
          <p>Publish WebAssembly modules for high-performance web apps</p>
        </div>
      </div>
      
      <p style="margin-top: 50px; color: #666;">
        <code>pack install my-package https://packcdn.workers.dev/cdn/package-id</code>
      </p>
    </body>
    </html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

function renderNotFound() {
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="text-align: center; padding: 50px; font-family: sans-serif;">
      <h1>Pack not found</h1>
      <p>This package doesn't exist or is private.</p>
      <a href="/">Back to PackCDN</a>
    </body>
    </html>
  `;
  return new Response(html, { status: 404, headers: { 'Content-Type': 'text/html' } });
}
