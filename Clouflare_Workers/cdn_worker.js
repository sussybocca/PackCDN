// Cloudflare Worker - packcdn.firefly-worker.workers.dev
// Enhanced to support all new features: WASM, versions, collaborators, etc.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const hostname = request.headers.get('host') || 'packcdn.firefly-worker.workers.dev';
    
    // Get the origin from the request
    const requestOrigin = request.headers.get('Origin');
    
    // Allowed origins
    const allowedOrigins = [
      'https://pack-cdn.vercel.app',
      'https://pack-dash.vercel.app',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      `https://${hostname}`,
      `http://${hostname}`
    ];
    
    // Determine if the origin is allowed
    let corsOrigin = '*';
    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      corsOrigin = requestOrigin;
    }
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Origin, X-Requested-With, X-API-Key',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };

    // Handle CORS preflight
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
        response = await handleCDN(request, path, hostname);
      } else if (path.startsWith('/pack/')) {
        response = await handlePackInfo(request, path, hostname);
      } else if (path.startsWith('/wasm/')) {
        response = await handleWasm(request, path, hostname);
      } else if (path.startsWith('/complex/')) {
        response = await handleComplexWasm(request, path, hostname);
      } else if (path.startsWith('/api/')) {
        response = await handleAPI(request, path, hostname);
      } else if (path.startsWith('/search')) {
        response = await handleSearch(request, url, hostname);
      } else if (path === '/') {
        response = handleHome(hostname);
      } else if (path === '/health') {
        response = new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path.startsWith('/docs/')) {
        response = await handleDocs(request, path, hostname);
      } else if (path.startsWith('/stats/')) {
        response = await handleStats(request, path, hostname);
      } else {
        response = new Response('Not Found', { 
          status: 404,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    } catch (error) {
      console.error('Worker error:', error);
      response = new Response(JSON.stringify({ 
        success: false, 
        error: 'Internal Server Error',
        message: error.message,
        timestamp: new Date().toISOString()
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
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

// Enhanced CDN handler with support for all new features
async function handleCDN(request, path, hostname) {
  const segments = path.split('/');
  const packId = segments[2];
  const filePath = segments.slice(3).join('/') || 'index.js';
  const version = request.headers.get('X-Pack-Version') || 
                  new URL(request.url).searchParams.get('v');
  
  if (!packId) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing pack ID',
      code: 'MISSING_PACK_ID'
    }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    console.log(`Fetching pack: ${packId}, file: ${filePath}, version: ${version || 'latest'}`);
    
    // Build API URL with version if specified
    let apiUrl = `https://pack-cdn.vercel.app/api/get-pack?id=${encodeURIComponent(packId)}`;
    if (version) {
      apiUrl += `&version=${encodeURIComponent(version)}`;
    }
    
    // Fetch pack from the enhanced get-pack API
    const apiResponse = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'PackCDN-Worker/2.0',
        'Accept': 'application/json',
        'Origin': `https://${hostname}`
      },
      cf: {
        // Cache API responses for 1 minute
        cacheTtl: 60,
        cacheEverything: true
      }
    });
    
    console.log(`API response status: ${apiResponse.status}`);
    
    if (!apiResponse.ok) {
      const error = await apiResponse.json().catch(() => ({}));
      console.error(`API error: ${apiResponse.status}`, error);
      
      return new Response(JSON.stringify({
        success: false,
        error: `Pack not found: ${packId}`,
        code: apiResponse.status === 404 ? 'PACK_NOT_FOUND' : 'API_ERROR',
        details: error.error || error.message || `API returned ${apiResponse.status}`
      }), { 
        status: apiResponse.status === 404 ? 404 : 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const result = await apiResponse.json();
    console.log(`API result success: ${result.success}`);
    
    if (!result.success || !result.pack) {
      return new Response(JSON.stringify({
        success: false,
        error: result.error || 'Invalid pack data',
        code: 'INVALID_PACK_DATA',
        packId
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const pack = result.pack;
    console.log(`Pack found: ${pack.name || pack.id}, package type: ${pack.package_type}, WASM: ${!!pack.wasm_url}`);
    
    // Check if package is private
    if (pack.is_public === false) {
      const authHeader = request.headers.get('Authorization');
      const apiKey = request.headers.get('X-API-Key');
      const encryptedKey = new URL(request.url).searchParams.get('key');
      
      // Verify access to private package
      if (!authHeader && !apiKey && !encryptedKey) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Private package requires authentication',
          code: 'PRIVATE_PACKAGE',
          packId: pack.id,
          name: pack.name
        }), { 
          status: 401,
          headers: { 
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Bearer realm="PackCDN", error="private_package"'
          }
        });
      }
    }
    
    // Get files from pack data
    if (!pack.files || typeof pack.files !== 'object') {
      console.error('No files object in pack:', pack);
      return new Response(JSON.stringify({
        success: false,
        error: 'No files in pack',
        code: 'NO_FILES',
        packId: pack.id,
        name: pack.name
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Find the requested file with enhanced fallback logic
    let fileContent = pack.files[filePath];
    let actualFilePath = filePath;
    
    // Enhanced fallback logic
    if (!fileContent) {
      console.log(`File not found: ${filePath}, trying fallbacks...`);
      
      // Special handling for common file types
      if (filePath === 'index.js' || filePath === 'main.js') {
        const commonEntryPoints = [
          'index.js', 'main.js', 'app.js', 'server.js',
          'index.mjs', 'main.mjs', 'index.cjs', 'main.cjs',
          'src/index.js', 'src/main.js', 'lib/index.js',
          'dist/index.js', 'dist/main.js', 'build/index.js'
        ];
        
        for (const entryPoint of commonEntryPoints) {
          if (pack.files[entryPoint]) {
            fileContent = pack.files[entryPoint];
            actualFilePath = entryPoint;
            console.log(`Found entry point: ${entryPoint}`);
            break;
          }
        }
      }
      
      // Try to find any matching file
      if (!fileContent) {
        const allFiles = Object.keys(pack.files);
        
        // Try case-insensitive match
        for (const fileName of allFiles) {
          if (fileName.toLowerCase() === filePath.toLowerCase()) {
            fileContent = pack.files[fileName];
            actualFilePath = fileName;
            console.log(`Found case-insensitive match: ${fileName}`);
            break;
          }
        }
        
        // Try partial match
        if (!fileContent && filePath.includes('.')) {
          const fileExt = filePath.split('.').pop();
          const matchingFiles = allFiles.filter(f => f.endsWith(`.${fileExt}`));
          if (matchingFiles.length === 1) {
            fileContent = pack.files[matchingFiles[0]];
            actualFilePath = matchingFiles[0];
            console.log(`Found single matching file: ${matchingFiles[0]}`);
          }
        }
      }
      
      // Last resort: return index.js if file not found
      if (!fileContent && filePath !== 'index.js') {
        fileContent = pack.files['index.js'];
        actualFilePath = 'index.js';
        if (!fileContent) {
          const firstFile = Object.values(pack.files)[0];
          if (firstFile) {
            fileContent = firstFile;
            actualFilePath = Object.keys(pack.files)[0];
            console.log(`Using first file as fallback: ${actualFilePath}`);
          }
        }
      }
    }
    
    if (!fileContent) {
      console.error(`File not found in pack: ${filePath}, available files:`, Object.keys(pack.files));
      
      // Return file listing for debugging
      const fileList = Object.keys(pack.files);
      return new Response(JSON.stringify({
        success: false,
        error: `File not found: ${filePath}`,
        code: 'FILE_NOT_FOUND',
        availableFiles: fileList,
        totalFiles: fileList.length,
        suggestion: fileList.length > 0 ? `Try one of: ${fileList.slice(0, 10).join(', ')}${fileList.length > 10 ? '...' : ''}` : 'No files available'
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`Serving file: ${actualFilePath}, content length: ${fileContent.length}, package type: ${pack.package_type}`);
    
    // Determine content type with enhanced MIME types
    const contentType = getContentType(actualFilePath);
    
    // Process content based on file type
    let processedContent = fileContent;
    let isBinary = false;
    
    if (actualFilePath.endsWith('.wasm')) {
      // Handle WebAssembly files
      isBinary = true;
      
      if (typeof fileContent === 'string' && fileContent.startsWith('data:application/wasm;base64,')) {
        const base64Data = fileContent.split(',')[1];
        processedContent = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        console.log(`Decoded base64 WASM: ${processedContent.length} bytes`);
      } else if (typeof fileContent === 'string') {
        // Try to parse as JSON string containing WASM
        try {
          const parsed = JSON.parse(fileContent);
          if (parsed.data && Array.isArray(parsed.data)) {
            processedContent = new Uint8Array(parsed.data);
            console.log(`Parsed JSON WASM: ${processedContent.length} bytes`);
          }
        } catch (e) {
          // Not JSON, treat as binary string
          processedContent = new TextEncoder().encode(fileContent);
        }
      }
    } else if (contentType.startsWith('image/') || 
               contentType === 'application/octet-stream' ||
               contentType === 'application/x-binary') {
      isBinary = true;
      if (typeof fileContent === 'string') {
        // Try to handle base64 encoded binary data
        if (fileContent.startsWith('data:')) {
          const matches = fileContent.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            const base64Data = matches[2];
            processedContent = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          }
        } else {
          processedContent = new TextEncoder().encode(fileContent);
        }
      }
    }
    
    const responseHeaders = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      'X-Pack-ID': pack.url_id || pack.id,
      'X-Pack-Name': pack.name || '',
      'X-Pack-Version': pack.version || '1.0.0',
      'X-Pack-Type': pack.package_type || 'basic',
      'X-File-Path': actualFilePath,
      'X-File-Size': processedContent.length.toString(),
      'X-WASM-Available': pack.wasm_url ? 'true' : 'false',
      'X-Complex-WASM-Available': pack.complex_wasm_url ? 'true' : 'false'
    };
    
    // Add WASM-specific headers
    if (actualFilePath.endsWith('.wasm')) {
      responseHeaders['Cross-Origin-Embedder-Policy'] = 'require-corp';
      responseHeaders['Cross-Origin-Opener-Policy'] = 'same-origin';
    }
    
    // Add content length for binary data
    if (isBinary) {
      responseHeaders['Content-Length'] = processedContent.length.toString();
    }
    
    // Handle Range requests for large files
    const rangeHeader = request.headers.get('Range');
    if (rangeHeader && isBinary) {
      return handleRangeRequest(rangeHeader, processedContent, responseHeaders);
    }
    
    return new Response(processedContent, {
      headers: responseHeaders
    });
    
  } catch (error) {
    console.error('CDN error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'CDN Error',
      message: error.message,
      code: 'CDN_ERROR',
      timestamp: new Date().toISOString()
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle WASM-specific endpoints
async function handleWasm(request, path, hostname) {
  const segments = path.split('/');
  const packId = segments[2];
  
  if (!packId) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing pack ID for WASM',
      code: 'MISSING_PACK_ID'
    }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get pack data
    const apiResponse = await fetch(
      `https://pack-cdn.vercel.app/api/get-pack?id=${encodeURIComponent(packId)}`,
      {
        headers: {
          'User-Agent': 'PackCDN-Worker/2.0',
          'Accept': 'application/json',
          'Origin': `https://${hostname}`
        }
      }
    );
    
    if (!apiResponse.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Pack not found',
        code: 'PACK_NOT_FOUND'
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const result = await apiResponse.json();
    
    if (!result.success || !result.pack) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid pack data',
        code: 'INVALID_PACK_DATA'
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const pack = result.pack;
    
    // Check if WASM is available
    if (!pack.wasm_url) {
      return new Response(JSON.stringify({
        success: false,
        error: 'WASM not available for this package',
        code: 'NO_WASM_AVAILABLE',
        metadata: pack.wasm_metadata || null
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Redirect to the WASM file in CDN
    return Response.redirect(`/cdn/${pack.url_id || pack.id}/compiled.wasm`, 302);
    
  } catch (error) {
    console.error('WASM handler error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch WASM',
      message: error.message,
      code: 'WASM_FETCH_ERROR'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle complex WASM endpoints
async function handleComplexWasm(request, path, hostname) {
  const segments = path.split('/');
  const packId = segments[2];
  
  if (!packId) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing pack ID for complex WASM',
      code: 'MISSING_PACK_ID'
    }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get pack data
    const apiResponse = await fetch(
      `https://pack-cdn.vercel.app/api/get-pack?id=${encodeURIComponent(packId)}`,
      {
        headers: {
          'User-Agent': 'PackCDN-Worker/2.0',
          'Accept': 'application/json',
          'Origin': `https://${hostname}`
        }
      }
    );
    
    if (!apiResponse.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Pack not found',
        code: 'PACK_NOT_FOUND'
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const result = await apiResponse.json();
    
    if (!result.success || !result.pack) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid pack data',
        code: 'INVALID_PACK_DATA'
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const pack = result.pack;
    
    // Check if complex WASM is available
    if (!pack.complex_wasm_url) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Complex WASM not available for this package',
        code: 'NO_COMPLEX_WASM_AVAILABLE',
        package_type: pack.package_type
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Redirect to the complex WASM file in CDN
    return Response.redirect(`/cdn/${pack.url_id || pack.id}/complex.wasm`, 302);
    
  } catch (error) {
    console.error('Complex WASM handler error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch complex WASM',
      message: error.message,
      code: 'COMPLEX_WASM_FETCH_ERROR'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle API endpoints (proxies to Vercel API)
async function handleAPI(request, path, hostname) {
  const apiPath = path.replace('/api/', '');
  const searchParams = new URL(request.url).searchParams;
  
  // Build the actual API URL
  let apiUrl = `https://pack-cdn.vercel.app/api/${apiPath}`;
  
  // Copy query parameters
  if (searchParams.toString()) {
    apiUrl += `?${searchParams.toString()}`;
  }
  
  try {
    const apiResponse = await fetch(apiUrl, {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers),
        'User-Agent': 'PackCDN-Worker/2.0',
        'Accept': 'application/json',
        'Origin': `https://${hostname}`
      },
      body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : undefined
    });
    
    // Clone the response to modify headers
    const response = new Response(apiResponse.body, apiResponse);
    
    // Add CORS headers
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers
    });
    
  } catch (error) {
    console.error('API proxy error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'API proxy failed',
      message: error.message,
      code: 'API_PROXY_ERROR'
    }), { 
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle pack information page - enhanced with new features
async function handlePackInfo(request, path, hostname) {
  const packId = path.split('/')[2];
  
  if (!packId) {
    return renderNotFound('Missing pack ID', hostname);
  }
  
  try {
    // Fetch enhanced pack data
    const response = await fetch(
      `https://pack-cdn.vercel.app/api/get-pack?id=${encodeURIComponent(packId)}&includeAdvanced=true`,
      {
        headers: {
          'Origin': `https://${hostname}`,
          'Accept': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      return renderNotFound(`Pack ${packId} not found`, hostname);
    }
    
    const result = await response.json();
    
    if (!result.success || !result.pack) {
      return renderNotFound(result.error || 'Pack not found', hostname);
    }
    
    const pack = result.pack;
    const metadata = result.metadata || {};
    const stats = result.stats || {};
    
    // Generate enhanced HTML page
    const html = generatePackInfoHTML(pack, metadata, stats, hostname);
    
    return new Response(html, {
      headers: { 
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=300'
      }
    });
    
  } catch (error) {
    console.error('Pack info error:', error);
    return renderNotFound('Error loading pack', hostname);
  }
}

// Handle documentation
async function handleDocs(request, path, hostname) {
  const docPath = path.replace('/docs/', '');
  
  if (!docPath || docPath === '') {
    // Show docs index
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>PackCDN Documentation</title>
      <style>
        body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .doc-section { margin: 2rem 0; padding: 1rem; background: #f5f5f5; border-radius: 5px; }
        .code { background: #1a1a1a; color: #00ff9d; padding: 1rem; border-radius: 5px; font-family: monospace; margin: 1rem 0; }
      </style>
    </head>
    <body>
      <h1>PackCDN Documentation</h1>
      
      <div class="doc-section">
        <h2>Getting Started</h2>
        <p>PackCDN is a modern package distribution system with WebAssembly support.</p>
        
        <h3>Installation</h3>
        <div class="code">
          # Using the Pack CLI<br>
          $ pack install my-package https://${hostname}/cdn/package-id
        </div>
        
        <h3>JavaScript Usage</h3>
        <div class="code">
          // ES Module<br>
          import pkg from 'https://${hostname}/cdn/package-id';<br><br>
          
          // CommonJS (via dynamic import)<br>
          const pkg = await import('https://${hostname}/cdn/package-id');<br><br>
          
          // With version pinning<br>
          import pkg from 'https://${hostname}/cdn/package-id@1.0.0';
        </div>
        
        <h3>WASM Packages</h3>
        <div class="code">
          // Load WASM wrapper<br>
          import { createWASM } from 'https://${hostname}/cdn/package-id/wasm-wrapper.js';<br><br>
          
          // Initialize WASM<br>
          const wasm = await createWASM();<br>
          const result = await wasm.calculate(10, 20);
        </div>
      </div>
      
      <div class="doc-section">
        <h2>Package Types</h2>
        <ul>
          <li><strong>Basic</strong>: Simple JavaScript packages</li>
          <li><strong>Standard</strong>: Packages with dependencies</li>
          <li><strong>Advanced</strong>: Full-featured packages with compilation</li>
          <li><strong>WASM</strong>: WebAssembly packages</li>
        </ul>
      </div>
      
      <div class="doc-section">
        <h2>API Reference</h2>
        <p><strong>CDN Endpoints:</strong></p>
        <ul>
          <li><code>GET /cdn/{id}</code> - Get package (defaults to index.js)</li>
          <li><code>GET /cdn/{id}/{file}</code> - Get specific file</li>
          <li><code>GET /wasm/{id}</code> - Get WASM binary</li>
          <li><code>GET /complex/{id}</code> - Get complex WASM</li>
          <li><code>GET /pack/{id}</code> - Package information page</li>
        </ul>
        
        <p><strong>Query Parameters:</strong></p>
        <ul>
          <li><code>v={version}</code> - Specify version</li>
          <li><code>key={encryption_key}</code> - Access private packages</li>
        </ul>
      </div>
      
      <div class="doc-section">
        <h2>Examples</h2>
        
        <h3>Basic Package</h3>
        <div class="code">
          // math-utils package<br>
          export function add(a, b) { return a + b; }<br>
          export function multiply(a, b) { return a * b; }
        </div>
        
        <h3>WASM Package</h3>
        <div class="code">
          // Compiled to WebAssembly<br>
          export function fibonacci(n) {<br>
            &nbsp;&nbsp;if (n <= 1) return n;<br>
            &nbsp;&nbsp;return fibonacci(n - 1) + fibonacci(n - 2);<br>
          }
        </div>
      </div>
      
      <div style="margin-top: 3rem; color: #666;">
        <p>For more information, visit <a href="https://pack-cdn.vercel.app">pack-cdn.vercel.app</a></p>
      </div>
    </body>
    </html>`;
    
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  return new Response('Documentation page not found', { status: 404 });
}

// Handle statistics
async function handleStats(request, path, hostname) {
  const packId = path.replace('/stats/', '');
  
  if (!packId) {
    // Show global stats
    return new Response(JSON.stringify({
      success: false,
      error: 'Global stats not yet implemented',
      code: 'NOT_IMPLEMENTED'
    }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const response = await fetch(
      `https://pack-cdn.vercel.app/api/pack-stats?id=${encodeURIComponent(packId)}`,
      {
        headers: {
          'Origin': `https://${hostname}`,
          'Accept': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Stats not available',
        code: 'STATS_UNAVAILABLE'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const stats = await response.json();
    
    return new Response(JSON.stringify(stats), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      }
    });
    
  } catch (error) {
    console.error('Stats error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch stats',
      message: error.message,
      code: 'STATS_FETCH_ERROR'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle search - enhanced
async function handleSearch(request, url, hostname) {
  const searchParams = url.searchParams;
  
  // Build query for your search API
  const searchUrl = new URL('https://pack-cdn.vercel.app/api/search');
  searchParams.forEach((value, key) => {
    searchUrl.searchParams.set(key, value);
  });
  
  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'PackCDN-Worker/2.0',
        'Accept': 'application/json',
        'Origin': `https://${hostname}`
      },
      cf: {
        cacheTtl: 30,
        cacheEverything: true
      }
    });
    
    if (!response.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: `Search API error: ${response.status}`,
        code: 'SEARCH_API_ERROR'
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const data = await response.json();
    
    return new Response(JSON.stringify(data), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30'
      }
    });
    
  } catch (error) {
    console.error('Search error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Search failed',
      message: error.message,
      code: 'SEARCH_ERROR',
      packs: [] 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Home page
function handleHome(hostname) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>PackCDN - Modern Package Distribution</title>
  <meta name="description" content="Create, publish, and serve packages instantly with WebAssembly support">
  <style>
    body { font-family: system-ui, sans-serif; text-align: center; padding: 50px; max-width: 800px; margin: 0 auto; }
    h1 { color: #667eea; font-size: 3em; margin-bottom: 0.5em; }
    .tagline { color: #666; font-size: 1.2em; margin-bottom: 2em; }
    .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin: 3rem 0; }
    .feature { background: #f5f5f5; padding: 1.5rem; border-radius: 8px; text-align: left; }
    .feature h3 { margin-top: 0; color: #667eea; }
    .code { background: #1a1a1a; color: #00ff9d; padding: 1rem; border-radius: 5px; font-family: monospace; margin: 1rem 0; text-align: left; }
    .cta { background: #667eea; color: white; padding: 15px 30px; border-radius: 5px; text-decoration: none; display: inline-block; margin: 10px; font-weight: bold; }
    .secondary-cta { background: white; color: #667eea; border: 2px solid #667eea; }
  </style>
</head>
<body>
  <h1>🚀 PackCDN</h1>
  <p class="tagline">Modern package distribution with WebAssembly support</p>
  
  <div class="code">
    # Install any package instantly<br>
    $ pack install my-package https://${hostname}/cdn/package-id
  </div>
  
  <div>
    <a href="https://pack-cdn.vercel.app/editor.html" class="cta">Create a Package</a>
    <a href="https://pack-cdn.vercel.app/explore.html" class="cta secondary-cta">Explore Packages</a>
    <a href="/docs" class="cta secondary-cta">Documentation</a>
  </div>
  
  <div class="features">
    <div class="feature">
      <h3>🎯 Instant Publishing</h3>
      <p>Publish packages with a single API call. No waiting, no build queues.</p>
    </div>
    <div class="feature">
      <h3>⚡ WebAssembly Support</h3>
      <p>Automatic JavaScript to WebAssembly compilation for high-performance packages.</p>
    </div>
    <div class="feature">
      <h3>🔒 Private Packages</h3>
      <p>Encrypted private packages with access control and collaboration.</p>
    </div>
    <div class="feature">
      <h3>📦 Multiple Formats</h3>
      <p>Support for JavaScript, TypeScript, Python, Rust, Go, and WebAssembly.</p>
    </div>
    <div class="feature">
      <h3>🌐 Global CDN</h3>
      <p>Built on Cloudflare's global network for lightning-fast delivery worldwide.</p>
    </div>
    <div class="feature">
      <h3>🔄 Version Management</h3>
      <p>Full version history with semantic versioning and rollback support.</p>
    </div>
  </div>
  
  <div style="margin-top: 3rem; color: #666;">
    <h3>Quick Examples</h3>
    <div class="code">
      // Use a package directly<br>
      import { add } from 'https://${hostname}/cdn/math-utils';<br>
      console.log(add(5, 3)); // 8
    </div>
    
    <div class="code">
      // Use WASM package<br>
      import createWASM from 'https://${hostname}/cdn/compute-wasm';<br>
      const wasm = await createWASM();<br>
      const result = await wasm.calculate(100, 200);
    </div>
  </div>
</body>
</html>`;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Helper functions

// Get content type for file
function getContentType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const mimeTypes = {
    // JavaScript
    'js': 'application/javascript',
    'mjs': 'application/javascript',
    'cjs': 'application/javascript',
    'jsx': 'application/javascript',
    
    // TypeScript
    'ts': 'application/typescript',
    'tsx': 'application/typescript',
    
    // WebAssembly
    'wasm': 'application/wasm',
    'wat': 'text/webassembly',
    
    // JSON
    'json': 'application/json',
    
    // Markdown
    'md': 'text/markdown',
    'markdown': 'text/markdown',
    
    // Text
    'txt': 'text/plain',
    'text': 'text/plain',
    
    // HTML
    'html': 'text/html',
    'htm': 'text/html',
    
    // CSS
    'css': 'text/css',
    'scss': 'text/x-scss',
    'sass': 'text/x-sass',
    
    // Python
    'py': 'text/x-python',
    'pyc': 'application/x-python-bytecode',
    'pyo': 'application/x-python-bytecode',
    
    // Rust
    'rs': 'text/rust',
    
    // Go
    'go': 'text/x-go',
    
    // Zig
    'zig': 'text/zig',
    
    // Images
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    
    // Data
    'csv': 'text/csv',
    'tsv': 'text/tab-separated-values',
    'xml': 'application/xml',
    'yaml': 'application/yaml',
    'yml': 'application/yaml',
    
    // Binary
    'bin': 'application/octet-stream',
    'dat': 'application/octet-stream'
  };
  
  return mimeTypes[ext] || 'text/plain';
}

// Handle range requests for large files
function handleRangeRequest(rangeHeader, content, headers) {
  const range = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!range) {
    return new Response('Invalid Range header', { status: 416 });
  }
  
  const start = parseInt(range[1]);
  const end = range[2] ? parseInt(range[2]) : content.length - 1;
  
  if (start >= content.length || end >= content.length || start > end) {
    return new Response('Range not satisfiable', { status: 416 });
  }
  
  const slicedContent = content.slice(start, end + 1);
  
  headers['Content-Range'] = `bytes ${start}-${end}/${content.length}`;
  headers['Content-Length'] = (end - start + 1).toString();
  
  return new Response(slicedContent, {
    status: 206,
    headers: headers
  });
}

// Generate enhanced pack info HTML
function generatePackInfoHTML(pack, metadata, stats, hostname) {
  const versionBadge = pack.version ? `<span class="badge version">v${pack.version}</span>` : '';
  const packageTypeBadge = `<span class="badge type">${pack.package_type || 'basic'}</span>`;
  const publicBadge = pack.is_public ? 
    `<span class="badge public">Public</span>` : 
    `<span class="badge private">Private</span>`;
  
  const wasmBadge = pack.wasm_url ? `<span class="badge wasm">WASM</span>` : '';
  const complexWasmBadge = pack.complex_wasm_url ? `<span class="badge complex-wasm">Complex WASM</span>` : '';
  
  const description = pack.pack_json && pack.pack_json.description ? 
    `<p class="description">${pack.pack_json.description}</p>` : '';
  
  const installCommand = pack.is_public ?
    `pack install ${pack.name || pack.id} https://${hostname}/cdn/${pack.url_id || pack.id}` :
    `pack install ${pack.name || pack.id} https://${hostname}/cdn/${pack.url_id || pack.id}?key=ENCRYPTION_KEY`;
  
  const filesList = pack.files ? Object.keys(pack.files).map(file => `
    <div class="file-item">
      <span class="file-name">${file}</span>
      ${file.endsWith('.wasm') ? '<span class="file-badge wasm">WASM</span>' : ''}
      ${file.endsWith('.js') ? '<span class="file-badge js">JS</span>' : ''}
      ${file.endsWith('.py') ? '<span class="file-badge python">Python</span>' : ''}
    </div>
  `).join('') : '<p>No files available</p>';
  
  const metadataInfo = metadata ? `
    <div class="metadata-section">
      <h3>📊 Metadata</h3>
      <div class="metadata-grid">
        <div class="metadata-item">
          <span class="label">Package Type:</span>
          <span class="value">${metadata.package_type || 'basic'}</span>
        </div>
        <div class="metadata-item">
          <span class="label">Sandbox Level:</span>
          <span class="value">${metadata.sandbox_level || 'basic'}</span>
        </div>
        <div class="metadata-item">
          <span class="label">Verification:</span>
          <span class="value ${metadata.verification_status === 'approved' ? 'verified' : ''}">
            ${metadata.verification_status || 'unknown'}
          </span>
        </div>
        <div class="metadata-item">
          <span class="label">Files:</span>
          <span class="value">${metadata.file_count || 0}</span>
        </div>
        <div class="metadata-item">
          <span class="label">Total Size:</span>
          <span class="value">${formatBytes(metadata.total_size || 0)}</span>
        </div>
        <div class="metadata-item">
          <span class="label">WASM Size:</span>
          <span class="value">${formatBytes(metadata.wasm_size || 0)}</span>
        </div>
      </div>
    </div>
  ` : '';
  
  const statsInfo = stats ? `
    <div class="stats-section">
      <h3>📈 Statistics</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-value">${stats.view_count || 0}</span>
          <span class="stat-label">Views</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${stats.download_count || 0}</span>
          <span class="stat-label">Downloads</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${stats.version_count || 1}</span>
          <span class="stat-label">Versions</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${stats.dependency_count || 0}</span>
          <span class="stat-label">Dependencies</span>
        </div>
      </div>
    </div>
  ` : '';
  
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>${pack.name || pack.id} - PackCDN</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      --primary: #667eea;
      --secondary: #764ba2;
      --success: #4CAF50;
      --warning: #ff9800;
      --danger: #f44336;
      --dark: #1a1a1a;
      --light: #f5f5f5;
      --text: #333;
      --text-light: #666;
    }
    
    * { box-sizing: border-box; }
    
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      max-width: 1000px; 
      margin: 0 auto; 
      padding: 20px; 
      color: var(--text);
      line-height: 1.6;
    }
    
    .header { 
      background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); 
      color: white; 
      padding: 2rem; 
      border-radius: 10px; 
      margin-bottom: 2rem; 
    }
    
    .badge { 
      background: var(--light); 
      color: var(--dark); 
      padding: 4px 12px; 
      border-radius: 20px; 
      font-size: 14px; 
      margin-right: 8px; 
      display: inline-block;
      margin-bottom: 8px;
    }
    
    .badge.version { background: var(--success); color: white; }
    .badge.type { background: var(--primary); color: white; }
    .badge.public { background: var(--success); color: white; }
    .badge.private { background: var(--warning); color: white; }
    .badge.wasm { background: #654ff0; color: white; }
    .badge.complex-wasm { background: #9c27b0; color: white; }
    
    .code { 
      background: var(--dark); 
      color: #00ff9d; 
      padding: 1rem; 
      border-radius: 5px; 
      font-family: 'SF Mono', Monaco, monospace; 
      margin: 1rem 0; 
      overflow-x: auto;
    }
    
    .section { 
      background: white; 
      padding: 1.5rem; 
      border-radius: 8px; 
      margin-bottom: 1.5rem; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .section h3 { 
      margin-top: 0; 
      color: var(--primary);
      border-bottom: 2px solid var(--light);
      padding-bottom: 0.5rem;
    }
    
    .file-item { 
      padding: 12px; 
      border-bottom: 1px solid var(--light); 
      display: flex;
      align-items: center;
    }
    
    .file-item:last-child { border-bottom: none; }
    
    .file-name { flex: 1; }
    .file-badge { 
      padding: 2px 8px; 
      border-radius: 12px; 
      font-size: 12px; 
      margin-left: 8px; 
    }
    .file-badge.wasm { background: #e3f2fd; color: #1976d2; }
    .file-badge.js { background: #fff3e0; color: #f57c00; }
    .file-badge.python { background: #e8f5e8; color: #388e3c; }
    
    .usage-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1rem;
      margin: 1rem 0;
    }
    
    .usage-item { 
      background: var(--light); 
      padding: 1rem; 
      border-radius: 5px; 
    }
    
    .metadata-grid, .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin: 1rem 0;
    }
    
    .metadata-item, .stat-item {
      background: var(--light);
      padding: 1rem;
      border-radius: 5px;
      text-align: center;
    }
    
    .metadata-item .label, .stat-item .stat-label {
      display: block;
      font-size: 0.9em;
      color: var(--text-light);
      margin-bottom: 0.5rem;
    }
    
    .metadata-item .value, .stat-item .stat-value {
      display: block;
      font-size: 1.2em;
      font-weight: bold;
      color: var(--primary);
    }
    
    .value.verified { color: var(--success); }
    
    .description {
      font-size: 1.1em;
      color: rgba(255, 255, 255, 0.9);
      margin: 1rem 0;
    }
    
    @media (max-width: 600px) {
      body { padding: 10px; }
      .header { padding: 1.5rem; }
      .section { padding: 1rem; }
      .usage-grid, .metadata-grid, .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${pack.name || 'Unnamed Pack'}</h1>
    ${description}
    <div>
      ${versionBadge}
      ${packageTypeBadge}
      ${publicBadge}
      ${wasmBadge}
      ${complexWasmBadge}
    </div>
  </div>
  
  <div class="section">
    <h3>📦 Installation</h3>
    <div class="code">${installCommand}</div>
    
    <div class="usage-grid">
      <div class="usage-item">
        <strong>ES Module</strong>
        <div class="code">
import pkg from 'https://${hostname}/cdn/${pack.url_id || pack.id}';<br>
// or<br>
import('https://${hostname}/cdn/${pack.url_id || pack.id}').then(...);
        </div>
      </div>
      
      <div class="usage-item">
        <strong>HTML Script</strong>
        <div class="code">
&lt;script src="https://${hostname}/cdn/${pack.url_id || pack.id}"&gt;&lt;/script&gt;
        </div>
      </div>
      
      ${pack.wasm_url ? `
      <div class="usage-item">
        <strong>WASM Usage</strong>
        <div class="code">
import createWASM from 'https://${hostname}/cdn/${pack.url_id || pack.id}/wasm-wrapper.js';<br>
const wasm = await createWASM();<br>
const result = await wasm.calculate(10, 20);
        </div>
      </div>
      ` : ''}
      
      ${pack.complex_wasm_url ? `
      <div class="usage-item">
        <strong>Complex WASM</strong>
        <div class="code">
import createComplexWASM from 'https://${hostname}/cdn/${pack.url_id || pack.id}/complex-wrapper.js';<br>
const wasm = await createComplexWASM({ memoryPages: 512 });<br>
const result = await wasm.dispatch(0, 100);
        </div>
      </div>
      ` : ''}
    </div>
  </div>
  
  ${metadataInfo}
  ${statsInfo}
  
  <div class="section">
    <h3>📁 Files (${pack.files ? Object.keys(pack.files).length : 0})</h3>
    <div class="files">
      ${filesList}
    </div>
  </div>
  
  <div class="section">
    <h3>🔗 Links</h3>
    <ul>
      <li>CDN: <a href="/cdn/${pack.url_id || pack.id}">/cdn/${pack.url_id || pack.id}</a></li>
      ${pack.wasm_url ? `<li>WASM: <a href="/wasm/${pack.url_id || pack.id}">/wasm/${pack.url_id || pack.id}</a></li>` : ''}
      ${pack.complex_wasm_url ? `<li>Complex WASM: <a href="/complex/${pack.url_id || pack.id}">/complex/${pack.url_id || pack.id}</a></li>` : ''}
      <li>Package Info: <a href="/api/get-pack?id=${pack.url_id || pack.id}">API JSON</a></li>
    </ul>
  </div>
  
  <div style="margin-top: 2rem; color: var(--text-light); font-size: 0.9em;">
    <p>Pack ID: ${pack.id}</p>
    <p>Created: ${new Date(pack.created_at).toLocaleString()}</p>
    <p>Last Updated: ${new Date(pack.updated_at || pack.created_at).toLocaleString()}</p>
    <p>Publisher: ${pack.publisher_id ? `User ${pack.publisher_id}` : 'Anonymous'}</p>
  </div>
  
  <script>
    // Auto-select install command on click
    document.querySelectorAll('.code').forEach(code => {
      code.addEventListener('click', function() {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(this);
        selection.removeAllRanges();
        selection.addRange(range);
      });
    });
  </script>
</body>
</html>`;
  
  return html;
}

// Format bytes to human readable
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Render 404 page
function renderNotFound(message = 'Pack not found', hostname) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>${message} - PackCDN</title>
  <style>
    body { 
      font-family: sans-serif; 
      text-align: center; 
      padding: 50px; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }
    h1 { font-size: 3em; margin-bottom: 1rem; }
    a { color: white; text-decoration: underline; }
  </style>
</head>
<body>
  <h1>${message}</h1>
  <p>The package you're looking for doesn't exist or has been removed.</p>
  <p><a href="https://${hostname}">Back to PackCDN</a></p>
</body>
</html>`;
  return new Response(html, { 
    status: 404, 
    headers: { 'Content-Type': 'text/html' } 
  });
}
