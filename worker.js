// Cloudflare Worker - packcdn.workers.dev
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Get the origin from the request
    const requestOrigin = request.headers.get('Origin');
    
    // Allowed origins - your Vercel site and localhost for development
    const allowedOrigins = [
      'https://pack-cdn.vercel.app',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ];
    
    // Determine if the origin is allowed
    let corsOrigin = '*';
    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      corsOrigin = requestOrigin;
    }
    
    // CORS headers - ALLOW POST for /api/publish.js
    const corsHeaders = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', // ADDED POST
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Origin, X-Requested-With',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };

    // Handle CORS preflight - this is what /api/publish.js needs
    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 204,
        headers: corsHeaders 
      });
    }

    // Route handlers
    let response;
    try {
      if (path.startsWith('/cdn/')) {
        response = await handleCDN(request, path);
      } else if (path.startsWith('/pack/')) {
        response = await handlePackInfo(request, path);
      } else if (path.startsWith('/search')) {
        response = await handleSearch(request, url);
      } else if (path === '/') {
        response = handleHome();
      } else {
        response = new Response('Not Found', { 
          status: 404,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    } catch (error) {
      console.error('Worker error:', error);
      response = new Response('Internal Server Error', { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Add CORS headers to response
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
      if (key !== 'Vary') {
        headers.set(key, value);
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers
    });
  }
};

// Handle CDN file serving
async function handleCDN(request, path) {
  const segments = path.split('/');
  const packId = segments[2];
  const filePath = segments.slice(3).join('/') || 'index.js';
  
  if (!packId) {
    return new Response('Missing pack ID', { 
      status: 400,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  try {
    // Fetch pack from the get-pack API
    const apiResponse = await fetch(
      `https://pack-cdn.vercel.app/api/get-pack?id=${encodeURIComponent(packId)}`,
      {
        headers: {
          'User-Agent': 'PackCDN-Worker/1.0',
          'Accept': 'application/json',
          'Origin': 'https://packcdn.firefly-worker.workers.dev/'
        }
      }
    );
    
    if (!apiResponse.ok) {
      return new Response(`Pack not found: ${packId}`, { 
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    const result = await apiResponse.json();
    
    if (!result.success || !result.pack) {
      return new Response(`Invalid pack data: ${packId}`, { 
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    const pack = result.pack;
    
    // Get files from pack data
    if (!pack.files || typeof pack.files !== 'object') {
      return new Response('No files in pack', { 
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // Find the requested file
    let fileContent = pack.files[filePath];
    
    // If file not found, try index.js as default
    if (!fileContent && filePath === 'index.js') {
      // Try common entry points
      fileContent = pack.files['main.js'] || 
                    pack.files['index.mjs'] || 
                    pack.files['app.js'] ||
                    Object.values(pack.files)[0];
    }
    
    if (!fileContent) {
      return new Response(`File not found: ${filePath}`, { 
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // Determine content type
    let contentType = 'text/plain';
    const ext = filePath.split('.').pop().toLowerCase();
    
    if (ext === 'js' || ext === 'mjs' || ext === 'cjs') {
      contentType = 'application/javascript';
    } else if (ext === 'py') {
      contentType = 'text/x-python';
    } else if (ext === 'wasm') {
      contentType = 'application/wasm';
    } else if (ext === 'json') {
      contentType = 'application/json';
    } else if (ext === 'html') {
      contentType = 'text/html';
    } else if (ext === 'css') {
      contentType = 'text/css';
    } else if (ext === 'md') {
      contentType = 'text/markdown';
    }
    
    return new Response(fileContent, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400'
      }
    });
    
  } catch (error) {
    console.error('CDN error:', error);
    return new Response(`CDN Error: ${error.message}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Handle search - proxy to your search API
async function handleSearch(request, url) {
  const searchParams = url.searchParams;
  
  // Build query for your search API
  const searchUrl = new URL('https://pack-cdn.vercel.app/api/search.js');
  searchParams.forEach((value, key) => {
    searchUrl.searchParams.set(key, value);
  });
  
  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'PackCDN-Worker/1.0',
        'Accept': 'application/json',
        'Origin': 'https://packcdn.firefly-worker.workers.dev/'
      }
    });
    
    if (!response.ok) {
      return new Response(`Search API error: ${response.status}`, {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const data = await response.json();
    
    return new Response(JSON.stringify(data), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      }
    });
    
  } catch (error) {
    console.error('Search error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Search failed',
        packs: [] 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle pack information page
async function handlePackInfo(request, path) {
  const packId = path.split('/')[2];
  
  if (!packId) {
    return renderNotFound('Missing pack ID');
  }
  
  try {
    // Fetch pack data
    const response = await fetch(
      `https://pack-cdn.vercel.app/api/get-pack?id=${encodeURIComponent(packId)}`,
      {
        headers: {
          'Origin': 'https://packcdn.workers.dev'
        }
      }
    );
    
    if (!response.ok) {
      return renderNotFound(`Pack ${packId} not found`);
    }
    
    const result = await response.json();
    
    if (!result.success || !result.pack) {
      return renderNotFound(result.error || 'Pack not found');
    }
    
    const pack = result.pack;
    
    // Generate HTML page
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${pack.name || packId} - PackCDN</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; border-radius: 10px; margin-bottom: 2rem; }
        .badge { background: #4CAF50; color: white; padding: 4px 12px; border-radius: 20px; font-size: 14px; margin-right: 8px; }
        .code { background: #1a1a1a; color: #00ff9d; padding: 1rem; border-radius: 5px; font-family: monospace; margin: 1rem 0; }
        .files { margin-top: 2rem; }
        .file-item { padding: 10px; border-bottom: 1px solid #eee; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${pack.name || 'Unnamed Pack'}</h1>
        <p>${pack.version ? `v${pack.version}` : ''} • ${pack.package_type || 'npm'} • ${pack.downloads || 0} downloads</p>
        <span class="badge">${pack.is_public ? 'Public' : 'Private'}</span>
      </div>
      
      <div class="code">
        $ pack install ${pack.name || packId} https://packcdn.firefly-worker.workers.dev/cdn/${packId}
      </div>
      
      <h3>Usage in JavaScript</h3>
      <div class="code">
        import pkg from 'https://packcdn.firefly-worker.workers.dev/cdn/${packId}';<br>
        // or<br>
        const pkg = await import('https://packcdn.firefly-worker.workers.dev/cdn/${packId}');
      </div>
      
      <h3>Usage in HTML</h3>
      <div class="code">
        &lt;script src="https://packcdn.firefly-worker.workers.dev/cdn/${packId}/index.js"&gt;&lt;/script&gt;
      </div>
      
      ${pack.pack_json && pack.pack_json.description ? `
      <h3>Description</h3>
      <p>${pack.pack_json.description}</p>
      ` : ''}
      
      <div class="files">
        <h3>Files (${pack.files ? Object.keys(pack.files).length : 0})</h3>
        ${pack.files ? Object.keys(pack.files).map(file => `
          <div class="file-item">
            <strong>${file}</strong>
            ${file === 'index.js' || file === 'main.js' ? '<span class="badge">Entry</span>' : ''}
          </div>
        `).join('') : '<p>No files</p>'}
      </div>
      
      <div style="margin-top: 2rem; color: #666;">
        <p>Pack ID: ${pack.id}</p>
        <p>Created: ${new Date(pack.created_at).toLocaleDateString()}</p>
        <p>CDN URL: <a href="/cdn/${packId}">/cdn/${packId}</a></p>
      </div>
    </body>
    </html>
    `;
    
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });
    
  } catch (error) {
    console.error('Pack info error:', error);
    return renderNotFound('Error loading pack');
  }
}

function handleHome() {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>PackCDN - Custom Package CDN</title>
  <style>
    body { font-family: sans-serif; text-align: center; padding: 50px; }
    h1 { color: #667eea; font-size: 3em; }
    .cta { background: #667eea; color: white; padding: 15px 30px; border-radius: 5px; text-decoration: none; display: inline-block; margin: 20px; }
    .code { background: #1a1a1a; color: #00ff9d; padding: 1rem; border-radius: 5px; font-family: monospace; margin: 20px auto; max-width: 600px; }
  </style>
</head>
<body>
  <h1>🚀 PackCDN</h1>
  <p>Create, publish, and serve custom packages instantly</p>
  
  <div class="code">
    # Install any pack<br>
    $ pack install my-package https://packcdn.firefly-worker.workers.dev/cdn/package-id
  </div>
  
  <a href="https://pack-cdn.vercel.app/editor.html" class="cta">Create a Pack</a>
  <a href="https://pack-cdn.vercel.app/explore.html" class="cta">Explore Packs</a>
  
  <div style="margin-top: 50px;">
    <h3>How it works:</h3>
    <p>1. Create your package using the editor</p>
    <p>2. Publish to get a CDN URL</p>
    <p>3. Use anywhere with the CDN link</p>
  </div>
</body>
</html>`;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

function renderNotFound(message = 'Pack not found') {
  const html = `<!DOCTYPE html>
<html>
<body style="text-align: center; padding: 50px; font-family: sans-serif;">
  <h1>${message}</h1>
  <a href="/">Back to PackCDN</a>
</body>
</html>`;
  return new Response(html, { 
    status: 404, 
    headers: { 'Content-Type': 'text/html' } 
  });
}
