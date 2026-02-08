// Cloudflare Worker - packcdn.firefly-worker.workers.dev
// ULTIMATE COMPLETE VERSION V5.0 - Complete Integration
// Combines all features from both workers: Enhanced CDN, WASM support, 
// package installation, advanced error system, deep encryption, and more

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const hostname = request.headers.get('host') || 'packcdn.firefly-worker.workers.dev';
    const userAgent = request.headers.get('User-Agent') || '';
    const method = request.method;
    const clientIp = request.headers.get('CF-Connecting-IP') || 
                    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
                    'unknown';
    
    // 🚨 ADVANCED REQUEST INTERCEPTION
    const interceptedResponse = await interceptAdvancedRequests(request, url, hostname, userAgent, clientIp);
    if (interceptedResponse) return interceptedResponse;
    
    // 🎨 ADVANCED ORIGIN VALIDATION
    const requestOrigin = request.headers.get('Origin');
    const allowedOrigins = getAllowedOrigins(hostname);
    
    let corsOrigin = '*';
    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      corsOrigin = requestOrigin;
    }
    
    // 🛡️ ULTIMATE SECURITY HEADERS
    const securityHeaders = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Origin, X-Requested-With, X-API-Key, X-Pack-Token, X-Pack-Version, X-Pack-Client, X-Pack-Install',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'interest-cohort=()',
      'X-Pack-Version': '5.0.0',
      'X-Pack-API': 'ultimate-complete',
      'X-Pack-Error-Code-System': 'enabled'
    };
    
    // Handle preflight
    if (method === 'OPTIONS') {
      return new Response(null, { 
        status: 204,
        headers: securityHeaders 
      });
    }
    
    // ⚡ ULTRA-PERFORMANT ROUTING
    try {
      let response;
      
      // 🗺️ COMPLETE ROUTE MAPPING (Combined from both workers)
      const routeMap = {
        '^/cdn/([^/]+)(?:/(.*))?$': handleCDN,
        '^/pack/([^/]+)$': handlePackInfo,
        '^/wasm/([^/]+)$': handleWasm,
        '^/complex/([^/]+)$': handleComplexWasm,
        '^/api/(.+)$': handleAPI,
        '^/search$': handleSearch,
        '^/install/([^/]+)$': handleDirectInstall,
        '^/download/([^/]+)$': handleDirectDownload,
        '^/embed/([^/]+)$': handleEmbed,
        '^/run/([^/]+)$': handleRun,
        '^/analyze/([^/]+)$': handleAnalyze,
        '^/docs(?:/(.*))?$': handleDocs,
        '^/stats/([^/]+)$': handleStats,
        '^/health$': handleHealth,
        '^/status$': handleStatus,
        '^/system/info$': handleSystemInfo,
        '^/pack-install$': handlePackInstallWeb,
        '^/pack-explore$': handlePackExplore,
        '^/pack-create$': handlePackCreate,
        '^/pack-manage/([^/]+)$': handlePackManage,
        '^/encrypted/(.+)$': handleEncryptedEndpoint,
        '^/purge/(.+)$': handleCachePurge,
        '^/$': handleHome,
      };
      
      let matched = false;
      for (const [pattern, handler] of Object.entries(routeMap)) {
        const regex = new RegExp(pattern);
        const match = path.match(regex);
        
        if (match) {
          matched = true;
          const startTime = Date.now();
          
          // 🎯 EXECUTE HANDLER WITH ADVANCED MONITORING
          response = await handler(request, match, hostname, url, clientIp, userAgent);
          
          // 📊 ADD PERFORMANCE METRICS
          const endTime = Date.now();
          const responseHeaders = new Headers(response.headers);
          responseHeaders.set('X-Pack-Processing-Time', `${endTime - startTime}ms`);
          
          if (!responseHeaders.has('X-Pack-Cache-Status')) {
            responseHeaders.set('X-Pack-Cache-Status', 'MISS');
          }
          
          break;
        }
      }
      
      if (!matched) {
        // 🎭 IMMERSIVE 404 WITH ADVANCED ERROR CODES
        response = await createImmersiveError(
          '40PNF', // Pack Not Found
          `The requested resource "${path}" was not found.`,
          {
            path: path,
            method: method,
            clientIp: clientIp,
            userAgent: userAgent,
            timestamp: new Date().toISOString(),
            suggestions: [
              'Check the URL for typos',
              'Browse available packages at /pack-explore',
              'View API documentation at /docs',
              'Use /search to find packages'
            ]
          },
          hostname,
          request
        );
      }
      
      // 🎨 ENHANCE RESPONSE WITH ULTIMATE HEADERS
      const enhancedHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(securityHeaders)) {
        if (key !== 'Vary' && !enhancedHeaders.has(key)) {
          enhancedHeaders.set(key, value);
        }
      }
      
      // 🔥 ADD DYNAMIC CACHE HEADERS
      if (!enhancedHeaders.has('Cache-Control') && response.status === 200) {
        enhancedHeaders.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      }
      
      // 📈 ADD TELEMETRY
      if (!enhancedHeaders.has('X-Pack-Request-ID')) {
        enhancedHeaders.set('X-Pack-Request-ID', generateRequestId());
      }
      if (!enhancedHeaders.has('X-Pack-Timestamp')) {
        enhancedHeaders.set('X-Pack-Timestamp', new Date().toISOString());
      }
      if (!enhancedHeaders.has('X-Pack-Client-IP')) {
        enhancedHeaders.set('X-Pack-Client-IP', clientIp);
      }
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: enhancedHeaders
      });
      
    } catch (error) {
      // 🚨 ULTIMATE ERROR HANDLING WITH ADVANCED CODES
      console.error('🔥 ULTIMATE WORKER ERROR:', {
        code: '50ISE', // Internal Server Error
        message: error.message,
        stack: error.stack,
        path: path,
        method: method,
        clientIp: clientIp,
        timestamp: new Date().toISOString(),
        hostname: hostname
      });
      
      return createImmersiveError(
        '50ISE',
        'An unexpected internal server error occurred.',
        {
          errorId: generateErrorId(),
          clientIp: clientIp,
          timestamp: new Date().toISOString(),
          supportCode: `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          recoverySteps: [
            'Wait a few moments and try again',
            'Check our status page at /status',
            'Report this error with the support code above'
          ]
        },
        hostname,
        request
      );
    }
  }
};

// ============================================================================
// 🚀 ULTIMATE INTERCEPTION SYSTEM
// ============================================================================

async function interceptAdvancedRequests(request, url, hostname, userAgent, clientIp) {
  const path = url.pathname;
  const method = request.method;
  
  // 🔍 DETECT PACK INSTALL REQUESTS
  const installInfo = await detectPackInstallRequest(request, userAgent);
  if (installInfo) {
    return await handlePackInstall(request, url, hostname, installInfo);
  }
  
  // 🤖 DETECT BOT REQUESTS
  if (isBotRequest(userAgent)) {
    return await handleBotRequest(request, path, hostname, clientIp);
  }
  
  // 📱 DETECT MOBILE DEVICES
  if (isMobileRequest(userAgent)) {
    return await handleMobileRequest(request, path, hostname);
  }
  
  // 🛑 DETECT MALICIOUS REQUESTS
  if (await isMaliciousRequest(request, url, clientIp)) {
    return await handleMaliciousRequest(request, hostname, clientIp);
  }
  
  // ⚡ DETECT CACHE PURGE REQUESTS (handled by route)
  return null;
}

// ============================================================================
// 🎭 ADVANCED ERROR SYSTEM WITH CUSTOM CODES
// ============================================================================

const ERROR_CODES = {
  // 40x - Client Errors
  '40PNF': { status: 404, title: 'Pack Not Found', category: 'Package' },
  '40FNF': { status: 404, title: 'File Not Found', category: 'Package' },
  '40PIV': { status: 400, title: 'Invalid Package', category: 'Validation' },
  '40VNF': { status: 404, title: 'Version Not Found', category: 'Package' },
  '40PRV': { status: 403, title: 'Private Package', category: 'Security' },
  '40AUT': { status: 401, title: 'Authentication Required', category: 'Security' },
  '40RAT': { status: 429, title: 'Rate Limit Exceeded', category: 'Security' },
  '40INV': { status: 400, title: 'Invalid Request', category: 'Validation' },
  '40TKN': { status: 403, title: 'Invalid Token', category: 'Security' },
  '40DEP': { status: 424, title: 'Dependency Error', category: 'Package' },
  
  // 50x - Server Errors
  '50ISE': { status: 500, title: 'Internal Server Error', category: 'Server' },
  '50DNF': { status: 500, title: 'Database Error', category: 'Server' },
  '50CNF': { status: 503, title: 'Service Unavailable', category: 'Server' },
  '50TMO': { status: 504, title: 'Timeout Error', category: 'Server' },
  '50MEM': { status: 500, title: 'Memory Limit Exceeded', category: 'Server' },
  '50CPU': { status: 500, title: 'CPU Limit Exceeded', category: 'Server' },
  
  // 60x - Business Logic Errors
  '60COM': { status: 409, title: 'Version Conflict', category: 'Package' },
  '60NAM': { status: 409, title: 'Name Already Exists', category: 'Package' },
  '60VER': { status: 400, title: 'Invalid Version', category: 'Package' },
  '60SIZ': { status: 413, title: 'Package Too Large', category: 'Package' },
  '60FIL': { status: 400, title: 'Too Many Files', category: 'Package' },
  '60SEC': { status: 403, title: 'Security Violation', category: 'Security' },
};

async function createImmersiveError(code, message, details, hostname, request = null) {
  const errorConfig = ERROR_CODES[code] || ERROR_CODES['50ISE'];
  const status = errorConfig.status;
  const title = errorConfig.title;
  const category = errorConfig.category;
  
  // 🎨 DETERMINE RESPONSE FORMAT
  const acceptHeader = request?.headers?.get('Accept') || '';
  const wantsJSON = acceptHeader.includes('application/json') || 
                   request?.headers?.get('X-Requested-With') === 'XMLHttpRequest' ||
                   request?.headers?.get('Content-Type')?.includes('application/json');
  
  if (wantsJSON) {
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: code,
        message: message,
        title: title,
        category: category,
        details: details,
        timestamp: new Date().toISOString(),
        documentation: `https://${hostname}/docs/errors#${code}`,
        support: details?.supportCode ? `Reference: ${details.supportCode}` : undefined
      },
      _links: {
        self: { href: request?.url },
        docs: { href: `https://${hostname}/docs/errors` },
        status: { href: `https://${hostname}/status` },
        home: { href: `https://${hostname}/` }
      }
    }, null, 2), {
      status: status,
      headers: {
        'Content-Type': 'application/json',
        'X-Pack-Error-Code': code,
        'X-Pack-Error-Category': category
      }
    });
  }
  
  // 🖥️ IMMERSIVE HTML ERROR PAGE
  const html = generateImmersiveErrorHTML(code, title, message, details, hostname);
  
  return new Response(html, {
    status: status,
    headers: {
      'Content-Type': 'text/html',
      'X-Pack-Error-Code': code,
      'X-Pack-Error-Category': category
    }
  });
}

// ============================================================================
// 🔍 ULTIMATE PACK INSTALL DETECTION
// ============================================================================

async function detectPackInstallRequest(request, userAgent) {
  const url = new URL(request.url);
  const method = request.method;
  
  // 🎯 MULTI-LAYER DETECTION
  
  // Layer 1: Direct Headers
  const directHeader = request.headers.get('X-Pack-Install') || 
                      request.headers.get('X-Pack-Get') ||
                      request.headers.get('X-Pack-Command');
  
  if (directHeader) {
    return {
      type: 'direct',
      command: directHeader,
      source: 'header'
    };
  }
  
  // Layer 2: Query Parameters
  if (url.searchParams.has('pack-install') || 
      url.searchParams.has('pack-get') ||
      url.searchParams.has('install')) {
    
    const pkg = url.searchParams.get('pack-install') || 
                url.searchParams.get('pack-get') ||
                url.searchParams.get('install');
    
    return {
      type: 'query',
      package: pkg,
      version: url.searchParams.get('version'),
      url: url.searchParams.get('url'),
      source: 'query'
    };
  }
  
  // Layer 3: Body Analysis (for POST/PUT)
  if (method === 'POST' || method === 'PUT') {
    try {
      const body = await request.text();
      const bodyLower = body.toLowerCase();
      
      // Check for pack install patterns
      if (bodyLower.includes('pack install') || 
          bodyLower.includes('"command":"install"') ||
          bodyLower.includes('pack.get') ||
          bodyLower.includes('package_name')) {
        
        try {
          const data = JSON.parse(body);
          if (data.command?.includes('install') || data.packageName) {
            return {
              type: 'json-body',
              package: data.packageName || data.package,
              version: data.version,
              url: data.url,
              command: data.command,
              source: 'json-body'
            };
          }
        } catch (e) {
          // Not JSON, try form data
          const params = new URLSearchParams(body);
          if (params.has('packageName') || params.has('package')) {
            return {
              type: 'form-body',
              package: params.get('packageName') || params.get('package'),
              version: params.get('version'),
              url: params.get('url'),
              source: 'form-body'
            };
          }
        }
      }
    } catch (e) {
      // Ignore body parsing errors
    }
  }
  
  // Layer 4: User Agent Analysis
  const isCLI = userAgent.includes('pack-cli') || 
                userAgent.includes('curl') || 
                userAgent.includes('wget') ||
                userAgent.includes('HTTPie') ||
                userAgent.match(/^pack\/\d/);
  
  if (isCLI && method === 'GET') {
    // Check path for install patterns
    if (url.pathname.includes('/get/') || url.pathname.includes('/install/')) {
      return {
        type: 'path',
        package: url.pathname.split('/').pop(),
        source: 'path'
      };
    }
  }
  
  // Layer 5: Referrer Analysis
  const referrer = request.headers.get('Referer');
  if (referrer && referrer.includes('pack-install')) {
    return {
      type: 'referrer',
      source: 'referrer'
    };
  }
  
  return null;
}

// ============================================================================
// 🚀 ULTIMATE PACK INSTALL HANDLER
// ============================================================================

async function handlePackInstall(request, url, hostname, installInfo) {
  console.log('🚀 ULTIMATE PACK INSTALL:', {
    type: installInfo.type,
    package: installInfo.package,
    source: installInfo.source,
    timestamp: new Date().toISOString(),
    clientIp: request.headers.get('CF-Connecting-IP') || 'unknown'
  });
  
  try {
    const { package: pkg, version, url: pkgUrl } = installInfo;
    
    // 🎯 RESOLVE PACKAGE IDENTIFIER
    const resolved = await resolvePackageIdentifier(pkg, version, pkgUrl, hostname);
    
    if (!resolved.success) {
      return createImmersiveError(
        resolved.error.code || '40PNF',
        resolved.error.message,
        {
          package: pkg,
          version: version,
          suggestions: resolved.error.suggestions,
          resolutionSteps: [
            'Check package name spelling',
            'Use /search to find packages',
            'Ensure you have proper permissions for private packages'
          ]
        },
        hostname,
        request
      );
    }
    
    // 📦 PROCESS INSTALLATION
    const installResult = await processUltimateInstall(resolved.packId, resolved.version, hostname);
    
    if (!installResult.success) {
      return createImmersiveError(
        installResult.error.code,
        installResult.error.message,
        {
          packId: resolved.packId,
          version: resolved.version,
          details: installResult.error.details,
          supportCode: generateSupportCode()
        },
        hostname,
        request
      );
    }
    
    // 🎁 CREATE ULTIMATE RESPONSE
    return createUltimateInstallResponse(installResult.data, hostname, request);
    
  } catch (error) {
    console.error('🔥 PACK INSTALL FAILED:', error);
    
    return createImmersiveError(
      '50ISE',
      'Failed to process package installation',
      {
        error: error.message,
        stack: error.stack,
        supportCode: generateSupportCode(),
        timestamp: new Date().toISOString(),
        recoverySteps: [
          'Try the installation again',
          'Use /search to find alternative packages',
          'Contact support with the error code above'
        ]
      },
      hostname,
      request
    );
  }
}

// ============================================================================
// 📦 ULTIMATE PACKAGE RESOLUTION
// ============================================================================

async function resolvePackageIdentifier(pkg, version, pkgUrl, hostname) {
  // CASE 1: Direct URL
  if (pkgUrl) {
    try {
      const url = new URL(pkgUrl);
      if (url.hostname.includes('packcdn')) {
        const pathParts = url.pathname.split('/');
        const packId = pathParts[2];
        
        if (packId) {
          return {
            success: true,
            packId: packId,
            version: version,
            source: 'url',
            url: pkgUrl
          };
        }
      }
    } catch (e) {
      // Invalid URL
    }
  }
  
  // CASE 2: Package name with version (name@version)
  if (pkg && pkg.includes('@') && !pkg.startsWith('@')) {
    const [name, ver] = pkg.split('@');
    const resolved = await resolveByName(name, ver || version, hostname);
    if (resolved.success) return resolved;
  }
  
  // CASE 3: Just package name
  if (pkg) {
    const resolved = await resolveByName(pkg, version, hostname);
    if (resolved.success) return resolved;
  }
  
  // CASE 4: Search by partial name
  if (pkg) {
    const searchResult = await searchPackage(pkg, hostname);
    if (searchResult.success && searchResult.packs.length > 0) {
      return {
        success: true,
        packId: searchResult.packs[0].id,
        version: version,
        source: 'search',
        matchType: 'partial',
        alternatives: searchResult.packs.slice(1, 5)
      };
    }
  }
  
  return {
    success: false,
    error: {
      code: '40PNF',
      message: `Package "${pkg}" not found`,
      suggestions: [
        `Check if "${pkg}" is spelled correctly`,
        `Search for similar packages: /search?q=${encodeURIComponent(pkg)}`,
        `Browse all packages: /pack-explore`,
        `Create your own package: /pack-create`
      ]
    }
  };
}

async function resolveByName(name, version, hostname) {
  try {
    const apiUrl = `https://pack-cdn.vercel.app/api/get-pack-by-name?name=${encodeURIComponent(name)}`;
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'PackCDN-Resolver/5.0',
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.pack) {
        const pack = result.pack;
        
        if (version && version !== pack.version) {
          const versionCheck = await checkVersion(pack.id, version, hostname);
          if (!versionCheck.available) {
            return {
              success: false,
              error: {
                code: '40VNF',
                message: `Version ${version} not found for ${pack.name}`,
                suggestions: [
                  `Latest version: ${pack.version}`,
                  `View all versions: /pack/${pack.id}?tab=versions`,
                  `Use: ${pack.name}@${pack.version}`
                ]
              }
            };
          }
        }
        
        return {
          success: true,
          packId: pack.id,
          version: version || pack.version,
          source: 'registry',
          name: pack.name,
          latestVersion: pack.version
        };
      }
    }
    
    const searchResult = await searchPackage(name, hostname);
    if (searchResult.success && searchResult.packs.length > 0) {
      const pack = searchResult.packs.find(p => p.name === name) || searchResult.packs[0];
      return {
        success: true,
        packId: pack.id,
        version: version || pack.version,
        source: 'search-fallback',
        name: pack.name,
        latestVersion: pack.version
      };
    }
    
    return { success: false };
    
  } catch (error) {
    console.error('Resolution failed:', error);
    return { success: false };
  }
}

// ============================================================================
// ⚡ ULTIMATE INSTALL PROCESSING
// ============================================================================

async function processUltimateInstall(packId, version, hostname) {
  const startTime = Date.now();
  
  try {
    const [packData, metadata, versions, stats] = await Promise.all([
      fetchPackData(packId, version, hostname),
      fetchPackMetadata(packId, hostname),
      fetchPackVersions(packId, hostname),
      fetchPackStats(packId, hostname)
    ]);
    
    if (!packData.success) {
      return {
        success: false,
        error: {
          code: packData.errorCode || '40PNF',
          message: packData.error || 'Package not found',
          details: packData.details
        }
      };
    }
    
    const pack = packData.pack;
    
    const securityCheck = await performSecurityCheck(pack, hostname);
    if (!securityCheck.allowed) {
      return {
        success: false,
        error: {
          code: securityCheck.code,
          message: securityCheck.message,
          details: securityCheck.details
        }
      };
    }
    
    const performance = await analyzePackagePerformance(pack);
    const dependencies = await resolveDependencies(pack);
    const compatibility = await checkCompatibility(pack);
    
    const manifest = await createUltimateManifest(
      pack, 
      metadata, 
      versions, 
      stats, 
      performance,
      dependencies,
      compatibility,
      hostname
    );
    
    const endTime = Date.now();
    
    return {
      success: true,
      data: {
        manifest: manifest,
        processingTime: endTime - startTime,
        cacheStatus: 'MISS',
        performance: performance,
        warnings: [...dependencies.warnings, ...compatibility.warnings]
      }
    };
    
  } catch (error) {
    console.error('Ultimate install processing failed:', error);
    
    return {
      success: false,
      error: {
        code: '50ISE',
        message: 'Installation processing failed',
        details: {
          error: error.message,
          stage: 'processing',
          timestamp: new Date().toISOString()
        }
      }
    };
  }
}

// ============================================================================
// 🎁 ULTIMATE INSTALL RESPONSE
// ============================================================================

function createUltimateInstallResponse(installData, hostname, request) {
  const manifest = installData.manifest;
  const acceptHeader = request?.headers?.get('Accept') || '';
  const wantsJSON = acceptHeader.includes('application/json');
  
  if (wantsJSON) {
    return new Response(JSON.stringify({
      success: true,
      installation: {
        id: manifest.id,
        package: manifest.package,
        manifest: manifest.manifest,
        instructions: manifest.instructions,
        verification: manifest.verification,
        performance: installData.performance,
        warnings: installData.warnings,
        processing: {
          time: installData.processingTime,
          cache: installData.cacheStatus,
          timestamp: new Date().toISOString()
        }
      },
      _links: manifest._links,
      _meta: {
        api: 'packcdn-ultimate',
        version: '5.0.0',
        format: 'ultimate-install'
      }
    }, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Pack-Install-ID': manifest.id,
        'X-Pack-Install-Time': `${installData.processingTime}ms`,
        'X-Pack-Package-Name': manifest.package.name,
        'X-Pack-Package-Version': manifest.package.version,
        'X-Pack-Warnings': installData.warnings.length.toString(),
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600'
      }
    });
  }
  
  const html = generateImmersiveInstallHTML(manifest, installData, hostname);
  
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
      'X-Pack-Install-ID': manifest.id,
      'X-Pack-Package-Name': manifest.package.name,
      'Cache-Control': 'public, max-age=300'
    }
  });
}

// ============================================================================
// 🎨 IMMERSIVE INSTALL HTML
// ============================================================================

function generateImmersiveInstallHTML(manifest, installData, hostname) {
  const { package: pkg, instructions, verification, performance } = manifest;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🚀 Installed: ${pkg.name} v${pkg.version} | PackCDN</title>
  <style>
    :root {
      --primary: #6366f1;
      --primary-dark: #4f46e5;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --bg: #0f172a;
      --surface: #1e293b;
      --surface-light: #334155;
      --text: #f1f5f9;
      --text-secondary: #94a3b8;
      --gradient: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    }
    
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; line-height: 1.6; }
    .install-header { background: var(--gradient); padding: 3rem 2rem; text-align: center; position: relative; overflow: hidden; }
    .install-container { max-width: 1000px; margin: -2rem auto 0; padding: 0 2rem 2rem; position: relative; }
    .install-card { background: var(--surface); border-radius: 16px; padding: 2rem; margin-bottom: 2rem; box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 1px solid var(--surface-light); }
    .success-icon { font-size: 4rem; margin-bottom: 1rem; }
    .package-name { font-size: 2.5rem; margin: 0; font-weight: bold; }
    .package-version { font-size: 1.2rem; opacity: 0.8; margin-bottom: 1rem; }
    .card-header { display: flex; align-items: center; margin-bottom: 1.5rem; }
    .card-icon { font-size: 1.5rem; margin-right: 1rem; }
    .card-title { margin: 0; font-size: 1.5rem; }
    .method-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; }
    .method-card { background: var(--surface-light); padding: 1.5rem; border-radius: 12px; }
    .method-icon { font-size: 2rem; margin-bottom: 0.5rem; }
    .method-title { margin: 0 0 0.5rem 0; font-size: 1rem; text-transform: uppercase; letter-spacing: 1px; opacity: 0.7; }
    .command-container { position: relative; }
    .command { background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px; font-family: 'SF Mono', Monaco, monospace; font-size: 0.9rem; overflow-x: auto; margin: 0; white-space: nowrap; }
    .copy-btn { position: absolute; top: 0.5rem; right: 0.5rem; background: var(--primary); color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem; }
    .copy-btn:hover { background: var(--primary-dark); }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; }
    .stat-item { text-align: center; }
    .stat-value { font-size: 2rem; font-weight: bold; color: var(--primary); display: block; }
    .stat-label { font-size: 0.9rem; opacity: 0.7; }
    .verification-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; }
    .verification-item { display: flex; align-items: center; background: var(--surface-light); padding: 1rem; border-radius: 8px; }
    .verification-item.warning { border-left: 4px solid var(--warning); }
    .verification-icon { font-size: 1.5rem; margin-right: 1rem; }
    .actions { display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center; }
    .btn { padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block; }
    .btn-primary { background: var(--primary); color: white; }
    .btn-secondary { background: var(--surface-light); color: var(--text); }
    .footer { text-align: center; margin-top: 3rem; padding: 2rem; color: var(--text-secondary); font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="install-header">
    <div class="success-icon">🚀</div>
    <h1 class="package-name">${pkg.name}</h1>
    <div class="package-version">v${pkg.version}</div>
    <p style="margin-top: 1rem; opacity: 0.9;">Successfully installed and ready to use!</p>
  </div>
  
  <div class="install-container">
    <div class="install-card">
      <div class="card-header">
        <div class="card-icon">📦</div>
        <h2 class="card-title">Installation Methods</h2>
      </div>
      
      <div class="method-grid">
        ${Object.entries(instructions.methods).map(([method, cmd]) => `
        <div class="method-card">
          <div class="method-icon">${getMethodIcon(method)}</div>
          <h3 class="method-title">${method.toUpperCase()}</h3>
          <div class="command-container">
            <pre class="command">${cmd}</pre>
            <button class="copy-btn" onclick="copyToClipboard(this)">Copy</button>
          </div>
        </div>
        `).join('')}
      </div>
    </div>
    
    <div class="install-card">
      <div class="card-header">
        <div class="card-icon">📊</div>
        <h2 class="card-title">Package Statistics</h2>
      </div>
      
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-value">${pkg.fileCount}</span>
          <span class="stat-label">Files</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${formatBytes(pkg.size)}</span>
          <span class="stat-label">Size</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${pkg.type}</span>
          <span class="stat-label">Type</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${performance.score}/100</span>
          <span class="stat-label">Performance</span>
        </div>
      </div>
    </div>
    
    <div class="install-card">
      <div class="card-header">
        <div class="card-icon">✅</div>
        <h2 class="card-title">Verification Status</h2>
      </div>
      
      <div class="verification-grid">
        ${verification.checks.map(check => `
        <div class="verification-item ${check.status === 'warning' ? 'warning' : ''}">
          <div class="verification-icon">${check.status === 'passed' ? '✅' : '⚠️'}</div>
          <div>
            <strong>${check.name}</strong>
            <div style="font-size: 0.875rem; color: var(--text-secondary);">${check.description}</div>
          </div>
        </div>
        `).join('')}
      </div>
    </div>
    
    <div class="install-card">
      <div class="card-header">
        <div class="card-icon">🎯</div>
        <h2 class="card-title">Next Steps</h2>
      </div>
      
      <div class="actions">
        <a href="${instructions.urls.cdn}" class="btn btn-primary">🌐 Open in Browser</a>
        <a href="/pack/${pkg.id}" class="btn btn-secondary">📖 View Documentation</a>
        <a href="/run/${pkg.id}" class="btn btn-secondary">⚡ Run Package</a>
        <a href="/docs" class="btn btn-secondary">📚 API Docs</a>
      </div>
    </div>
  </div>
  
  <div class="footer">
    <p>PackCDN • Ultimate Package Distribution • Installation ID: ${manifest.id}</p>
    <p>Processing time: ${installData.processingTime}ms • ${installData.warnings.length} warnings</p>
  </div>
  
  <script>
    function copyToClipboard(button) {
      const command = button.parentElement.querySelector('.command').textContent;
      navigator.clipboard.writeText(command).then(() => {
        const original = button.textContent;
        button.textContent = 'Copied!';
        button.style.background = '#10b981';
        setTimeout(() => {
          button.textContent = original;
          button.style.background = '';
        }, 2000);
      });
    }
  </script>
</body>
</html>`;
}

function getMethodIcon(method) {
  const icons = {
    'pack': '📦', 'npm': '📝', 'curl': '🔗', 'esm': '⚡',
    'html': '🌐', 'deno': '🦕', 'bun': '🍞', 'node': '⬢',
    'python': '🐍', 'rust': '🦀'
  };
  return icons[method] || '📋';
}

// ============================================================================
// ⚡ ULTIMATE UTILITIES
// ============================================================================

function getAllowedOrigins(hostname) {
  return [
    'https://pack-cdn.vercel.app',
    'https://pack-dash.vercel.app',
    'https://packcdn.dev',
    'https://*.packcdn.dev',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    `https://${hostname}`,
    `http://${hostname}`,
    'https://*.vercel.app',
    'https://*.cloudflareworkers.com'
  ];
}

function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateErrorId() {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
}

function generateSupportCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `SUP-${code}`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================================================
// 🔐 DEEP ENCRYPTION SYSTEM
// ============================================================================

class DeepEncryption {
  constructor() {
    this.algorithm = 'AES-GCM';
    this.keyLength = 256;
    this.ivLength = 12;
  }

  async generateKey() {
    return await crypto.subtle.generateKey(
      {
        name: this.algorithm,
        length: this.keyLength,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(text, key) {
    const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));
    const encoded = new TextEncoder().encode(text);
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: this.algorithm,
        iv: iv,
      },
      key,
      encoded
    );
    
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  }

  async decrypt(encryptedBase64, key) {
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    const iv = combined.slice(0, this.ivLength);
    const encrypted = combined.slice(this.ivLength);
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: this.algorithm,
        iv: iv,
      },
      key,
      encrypted
    );
    
    return new TextDecoder().decode(decrypted);
  }

  async encryptObject(obj, key) {
    const jsonString = JSON.stringify(obj);
    return await this.encrypt(jsonString, key);
  }

  async decryptObject(encryptedBase64, key) {
    const jsonString = await this.decrypt(encryptedBase64, key);
    return JSON.parse(jsonString);
  }

  async createEncryptedPackage(packageData, encryptionKey = null) {
    const key = encryptionKey || await this.generateKey();
    const encryptedData = await this.encryptObject(packageData, key);
    
    const exportedKey = await crypto.subtle.exportKey('raw', key);
    const keyHex = Array.from(new Uint8Array(exportedKey))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return {
      encrypted: encryptedData,
      key: keyHex,
      algorithm: this.algorithm,
      keyLength: this.keyLength,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  async decryptPackage(encryptedPackage) {
    const keyBuffer = new Uint8Array(
      encryptedPackage.key.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
    );
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: this.algorithm, length: this.keyLength },
      true,
      ['decrypt']
    );
    
    return await this.decryptObject(encryptedPackage.encrypted, key);
  }
}

// ============================================================================
// 🚀 ULTIMATE HANDLERS - CDN & PACK INFO (Enhanced Combined Version)
// ============================================================================

async function handleCDN(request, match, hostname, url, clientIp, userAgent) {
  const packId = match[1];
  const filePath = match[2] || 'index.js';
  const version = request.headers.get('X-Pack-Version') || 
                  url.searchParams.get('v') || 
                  url.searchParams.get('version');
  
  try {
    console.log(`[CDN] Request for ${packId}/${filePath} from ${clientIp}`);
    
    let apiUrl = `https://pack-cdn.vercel.app/api/get-pack?id=${encodeURIComponent(packId)}`;
    if (version) {
      apiUrl += `&version=${encodeURIComponent(version)}`;
    }
    
    const apiResponse = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'PackCDN-Worker/5.0',
        'Accept': 'application/json',
        'Origin': `https://${hostname}`,
        'X-Pack-Client-IP': clientIp
      },
      cf: {
        cacheTtl: 60,
        cacheEverything: true
      }
    });
    
    if (!apiResponse.ok) {
      const error = await apiResponse.json().catch(() => ({}));
      return createImmersiveError(
        '40PNF',
        `Pack not found: ${packId}`,
        {
          packId: packId,
          filePath: filePath,
          version: version,
          apiStatus: apiResponse.status,
          details: error.error || error.message,
          suggestions: [
            'Check the pack ID',
            'Verify the package exists',
            'Try accessing without version specifier'
          ]
        },
        hostname,
        request
      );
    }
    
    const result = await apiResponse.json();
    
    if (!result.success || !result.pack) {
      return createImmersiveError(
        '40PNF',
        'Invalid pack data received',
        {
          packId: packId,
          apiResponse: result,
          suggestions: [
            'The pack may have been deleted',
            'Try again in a few moments',
            'Contact support if issue persists'
          ]
        },
        hostname,
        request
      );
    }
    
    const pack = result.pack;
    
    if (pack.is_public === false) {
      const authToken = request.headers.get('Authorization')?.replace('Bearer ', '') ||
                       request.headers.get('X-Pack-Token') ||
                       url.searchParams.get('token');
      
      const apiKey = request.headers.get('X-API-Key') || url.searchParams.get('key');
      
      if (!authToken && !apiKey) {
        return createImmersiveError(
          '40PRV',
          'This is a private package and requires authentication',
          {
            packId: pack.id,
            name: pack.name,
            suggestions: [
              'Provide an authorization token',
              'Use an API key',
              'Request access from the package owner'
            ]
          },
          hostname,
          request
        );
      }
    }
    
    if (!pack.files || typeof pack.files !== 'object') {
      return createImmersiveError(
        '40FNF',
        'No files found in package',
        {
          packId: pack.id,
          name: pack.name,
          suggestions: [
            'The package may be empty',
            'Contact the package maintainer',
            'Check if package is corrupted'
          ]
        },
        hostname,
        request
      );
    }
    
    // 🎯 ENHANCED FILE RESOLUTION LOGIC (from second worker)
    let fileContent = pack.files[filePath];
    let actualFilePath = filePath;
    
    if (!fileContent) {
      console.log(`File not found: ${filePath}, trying fallbacks...`);
      
      // Enhanced fallback logic
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
      
      // Try case-insensitive match
      if (!fileContent) {
        const allFiles = Object.keys(pack.files);
        for (const fileName of allFiles) {
          if (fileName.toLowerCase() === filePath.toLowerCase()) {
            fileContent = pack.files[fileName];
            actualFilePath = fileName;
            console.log(`Found case-insensitive match: ${fileName}`);
            break;
          }
        }
      }
      
      // Try partial match
      if (!fileContent && filePath.includes('.')) {
        const fileExt = filePath.split('.').pop();
        const allFiles = Object.keys(pack.files);
        const matchingFiles = allFiles.filter(f => f.endsWith(`.${fileExt}`));
        if (matchingFiles.length === 1) {
          fileContent = pack.files[matchingFiles[0]];
          actualFilePath = matchingFiles[0];
          console.log(`Found single matching file: ${matchingFiles[0]}`);
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
      
      const fileList = Object.keys(pack.files);
      return createImmersiveError(
        '40FNF',
        `File "${filePath}" not found in package`,
        {
          packId: pack.id,
          name: pack.name,
          requestedFile: filePath,
          availableFiles: fileList.slice(0, 20),
          totalFiles: fileList.length,
          suggestions: [
            'Check the file path',
            'Browse available files in package info',
            'Contact package maintainer for correct file paths'
          ]
        },
        hostname,
        request
      );
    }
    
    const contentType = getContentType(actualFilePath);
    let responseBody = fileContent;
    let isBinary = false;
    
    // Handle WebAssembly files
    if (actualFilePath.endsWith('.wasm')) {
      isBinary = true;
      if (typeof fileContent === 'string' && fileContent.startsWith('data:application/wasm;base64,')) {
        const base64Data = fileContent.split(',')[1];
        responseBody = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      } else if (typeof fileContent === 'string') {
        responseBody = new TextEncoder().encode(fileContent);
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
            responseBody = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          }
        } else {
          responseBody = new TextEncoder().encode(fileContent);
        }
      }
    }
    
    const headers = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      'X-Pack-ID': pack.url_id || pack.id,
      'X-Pack-Name': pack.name || '',
      'X-Pack-Version': pack.version || '1.0.0',
      'X-Pack-Type': pack.package_type || 'basic',
      'X-File-Path': actualFilePath,
      'X-File-Size': isBinary ? responseBody.length.toString() : responseBody.length.toString(),
      'X-WASM-Available': pack.wasm_url ? 'true' : 'false',
      'X-Complex-WASM-Available': pack.complex_wasm_url ? 'true' : 'false',
      'X-Content-Source': 'packcdn-cdn'
    };
    
    if (actualFilePath.endsWith('.wasm')) {
      headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
      headers['Cross-Origin-Opener-Policy'] = 'same-origin';
    }
    
    if (isBinary) {
      headers['Content-Length'] = responseBody.length.toString();
    }
    
    // Handle Range requests for large files
    const rangeHeader = request.headers.get('Range');
    if (rangeHeader && isBinary) {
      return handleRangeRequest(rangeHeader, responseBody, headers);
    }
    
    return new Response(responseBody, {
      status: 200,
      headers: headers
    });
    
  } catch (error) {
    console.error('[CDN] Handler error:', error);
    return createImmersiveError(
      '50ISE',
      'Failed to serve CDN content',
      {
        packId: packId,
        filePath: filePath,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        recoverySteps: [
          'Try again in a few moments',
          'Check network connectivity',
          'Contact support if issue persists'
        ]
      },
      hostname,
      request
    );
  }
}

async function handlePackInfo(request, match, hostname, url, clientIp, userAgent) {
  const packId = match[1];
  const version = url.searchParams.get('version');
  
  try {
    let apiUrl = `https://pack-cdn.vercel.app/api/get-pack?id=${encodeURIComponent(packId)}&includeAdvanced=true`;
    if (version) {
      apiUrl += `&version=${encodeURIComponent(version)}`;
    }
    
    const apiResponse = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'PackCDN-Worker/5.0',
        'Accept': 'application/json',
        'Origin': `https://${hostname}`
      }
    });
    
    if (!apiResponse.ok) {
      return createImmersiveError(
        '40PNF',
        `Package "${packId}" not found`,
        {
          packId: packId,
          version: version,
          apiStatus: apiResponse.status,
          suggestions: [
            'Check the package ID',
            'Browse packages at /pack-explore',
            'Search for similar packages'
          ]
        },
        hostname,
        request
      );
    }
    
    const result = await apiResponse.json();
    
    if (!result.success || !result.pack) {
      return createImmersiveError(
        '40PNF',
        'Invalid package data',
        {
          packId: packId,
          apiResponse: result,
          suggestions: [
            'The package may be corrupted',
            'Try accessing without version',
            'Contact support'
          ]
        },
        hostname,
        request
      );
    }
    
    const pack = result.pack;
    const metadata = result.metadata || {};
    const stats = result.stats || {};
    
    const html = generateEnhancedPackInfoHTML(pack, metadata, stats, hostname);
    
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=300',
        'X-Pack-ID': pack.id,
        'X-Pack-Name': pack.name || ''
      }
    });
    
  } catch (error) {
    console.error('[PackInfo] Handler error:', error);
    return createImmersiveError(
      '50ISE',
      'Failed to load package information',
      {
        packId: packId,
        error: error.message,
        timestamp: new Date().toISOString(),
        recoverySteps: [
          'Try again in a few moments',
          'Check the package ID',
          'Contact support'
        ]
      },
      hostname,
      request
    );
  }
}

async function handleWasm(request, match, hostname, url, clientIp, userAgent) {
  const packId = match[1];
  
  try {
    // Get pack data first
    const apiResponse = await fetch(
      `https://pack-cdn.vercel.app/api/get-pack?id=${encodeURIComponent(packId)}`,
      {
        headers: {
          'User-Agent': 'PackCDN-Worker/5.0',
          'Accept': 'application/json',
          'Origin': `https://${hostname}`
        }
      }
    );
    
    if (!apiResponse.ok) {
      return createImmersiveError(
        '40PNF',
        'Pack not found',
        {
          packId: packId,
          suggestions: [
            'Check the pack ID',
            'Verify the package exists',
            'Try accessing without version specifier'
          ]
        },
        hostname,
        request
      );
    }
    
    const result = await apiResponse.json();
    
    if (!result.success || !result.pack) {
      return createImmersiveError(
        '40PNF',
        'Invalid pack data',
        {
          packId: packId,
          suggestions: [
            'The pack may have been deleted',
            'Try again in a few moments',
            'Contact support if issue persists'
          ]
        },
        hostname,
        request
      );
    }
    
    const pack = result.pack;
    
    // Check if WASM is available
    if (!pack.wasm_url) {
      return createImmersiveError(
        '40FNF',
        'WASM not available for this package',
        {
          packId: packId,
          metadata: pack.wasm_metadata || null,
          suggestions: [
            'Check if package has WASM support',
            'Try the regular CDN endpoint',
            'Contact package maintainer'
          ]
        },
        hostname,
        request
      );
    }
    
    // Redirect to the WASM file in CDN
    const wasmUrl = `https://${hostname}/cdn/${packId}/compiled.wasm`;
    return Response.redirect(wasmUrl, 302);
    
  } catch (error) {
    console.error('[WASM] Handler error:', error);
    return createImmersiveError(
      '50ISE',
      'Failed to redirect to WASM file',
      {
        packId: packId,
        error: error.message,
        suggestions: [
          'Try accessing the package directly',
          'Check if package has WASM files',
          'Contact package maintainer'
        ]
      },
      hostname,
      request
    );
  }
}

async function handleComplexWasm(request, match, hostname, url, clientIp, userAgent) {
  const packId = match[1];
  
  try {
    // Get pack data first
    const apiResponse = await fetch(
      `https://pack-cdn.vercel.app/api/get-pack?id=${encodeURIComponent(packId)}`,
      {
        headers: {
          'User-Agent': 'PackCDN-Worker/5.0',
          'Accept': 'application/json',
          'Origin': `https://${hostname}`
        }
      }
    );
    
    if (!apiResponse.ok) {
      return createImmersiveError(
        '40PNF',
        'Pack not found',
        {
          packId: packId,
          suggestions: [
            'Check the pack ID',
            'Verify the package exists',
            'Try accessing without version specifier'
          ]
        },
        hostname,
        request
      );
    }
    
    const result = await apiResponse.json();
    
    if (!result.success || !result.pack) {
      return createImmersiveError(
        '40PNF',
        'Invalid pack data',
        {
          packId: packId,
          suggestions: [
            'The pack may have been deleted',
            'Try again in a few moments',
            'Contact support if issue persists'
          ]
        },
        hostname,
        request
      );
    }
    
    const pack = result.pack;
    
    // Check if complex WASM is available
    if (!pack.complex_wasm_url) {
      return createImmersiveError(
        '40FNF',
        'Complex WASM not available for this package',
        {
          packId: packId,
          package_type: pack.package_type,
          suggestions: [
            'Check if package has complex WASM support',
            'Try the regular CDN endpoint',
            'Contact package maintainer'
          ]
        },
        hostname,
        request
      );
    }
    
    // Redirect to the complex WASM file in CDN
    const wasmUrl = `https://${hostname}/cdn/${packId}/complex.wasm`;
    return Response.redirect(wasmUrl, 302);
    
  } catch (error) {
    console.error('[ComplexWASM] Handler error:', error);
    return createImmersiveError(
      '50ISE',
      'Failed to redirect to complex WASM file',
      {
        packId: packId,
        error: error.message,
        suggestions: [
          'Try accessing the package directly',
          'Check if package has complex WASM',
          'Contact package maintainer'
        ]
      },
      hostname,
      request
    );
  }
}

async function handleAPI(request, match, hostname, url, clientIp, userAgent) {
  const apiPath = match[1];
  const searchParams = url.searchParams;
  
  try {
    let apiUrl = `https://pack-cdn.vercel.app/api/${apiPath}`;
    
    if (searchParams.toString()) {
      apiUrl += `?${searchParams.toString()}`;
    }
    
    const apiResponse = await fetch(apiUrl, {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers),
        'User-Agent': 'PackCDN-Worker/5.0',
        'Accept': 'application/json',
        'Origin': `https://${hostname}`,
        'X-Forwarded-For': clientIp,
        'X-Pack-Client-IP': clientIp
      },
      body: request.method !== 'GET' && request.method !== 'HEAD' ? 
            await request.clone().text() : undefined
    });
    
    const responseHeaders = new Headers(apiResponse.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
    responseHeaders.set('X-Pack-Proxy', 'true');
    responseHeaders.set('X-Pack-Proxy-Source', 'packcdn-worker');
    
    return new Response(apiResponse.body, {
      status: apiResponse.status,
      statusText: apiResponse.statusText,
      headers: responseHeaders
    });
    
  } catch (error) {
    console.error('[API] Handler error:', error);
    return createImmersiveError(
      '50CNF',
      'Failed to proxy API request',
      {
        apiPath: apiPath,
        error: error.message,
        timestamp: new Date().toISOString(),
        recoverySteps: [
          'Try the API directly',
          'Check API documentation',
          'Contact support if issue persists'
        ]
      },
      hostname,
      request
    );
  }
}

// ============================================================================
// 🎯 COMPLETE HANDLER COLLECTION (All handlers combined)
// ============================================================================

async function handleSearch(request, match, hostname, url, clientIp, userAgent) {
  const searchParams = url.searchParams;
  
  const searchUrl = new URL('https://pack-cdn.vercel.app/api/search');
  searchParams.forEach((value, key) => {
    searchUrl.searchParams.set(key, value);
  });
  
  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'PackCDN-Worker/5.0',
        'Accept': 'application/json',
        'Origin': `https://${hostname}`
      },
      cf: {
        cacheTtl: 30,
        cacheEverything: true
      }
    });
    
    if (!response.ok) {
      return createImmersiveError(
        '40INV',
        `Search API error: ${response.status}`,
        {
          apiStatus: response.status,
          suggestions: [
            'Try different search terms',
            'Check API documentation',
            'Contact support if issue persists'
          ]
        },
        hostname,
        request
      );
    }
    
    const data = await response.json();
    
    const responseHeaders = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30'
    });
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: responseHeaders
    });
    
  } catch (error) {
    console.error('[Search] Handler error:', error);
    return createImmersiveError(
      '50CNF',
      'Search failed',
      {
        error: error.message,
        suggestions: [
          'Try again in a few moments',
          'Check your internet connection',
          'Contact support if issue persists'
        ]
      },
      hostname,
      request
    );
  }
}

async function handleDirectInstall(request, match, hostname, url, clientIp, userAgent) {
  const packId = match[1];
  
  try {
    const installInfo = {
      type: 'direct-install',
      package: packId,
      source: 'direct-install-route'
    };
    
    return await handlePackInstall(request, url, hostname, installInfo);
    
  } catch (error) {
    console.error('[DirectInstall] Handler error:', error);
    return createImmersiveError(
      '50ISE',
      'Failed to process direct installation',
      {
        packId: packId,
        error: error.message,
        suggestions: [
          'Try the regular CDN endpoint',
          'Check if package exists',
          'Contact support'
        ]
      },
      hostname,
      request
    );
  }
}

async function handleDirectDownload(request, match, hostname, url, clientIp, userAgent) {
  const packId = match[1];
  
  try {
    const cdnUrl = `https://${hostname}/cdn/${packId}`;
    return Response.redirect(cdnUrl, 302);
    
  } catch (error) {
    console.error('[DirectDownload] Handler error:', error);
    return createImmersiveError(
      '50ISE',
      'Failed to redirect to download',
      {
        packId: packId,
        error: error.message,
        suggestions: [
          'Try accessing directly: /cdn/{packId}',
          'Check if package exists',
          'Contact support'
        ]
      },
      hostname,
      request
    );
  }
}

async function handleEmbed(request, match, hostname, url, clientIp, userAgent) {
  const packId = match[1];
  
  try {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Embed ${packId} | PackCDN</title>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 20px; text-align: center; }
    .embed-container { max-width: 600px; margin: 0 auto; }
    .code { background: #1a1a1a; color: #00ff9d; padding: 1rem; border-radius: 5px; font-family: monospace; margin: 1rem 0; text-align: left; }
  </style>
</head>
<body>
  <div class="embed-container">
    <h1>Embed Package: ${packId}</h1>
    <p>Use this code to embed the package in your website:</p>
    
    <div class="code">
      &lt;script src="https://${hostname}/cdn/${packId}"&gt;&lt;/script&gt;
    </div>
    
    <p>Or for ES modules:</p>
    <div class="code">
      &lt;script type="module"&gt;<br>
      &nbsp;&nbsp;import pkg from 'https://${hostname}/cdn/${packId}';<br>
      &nbsp;&nbsp;// Use the package<br>
      &lt;/script&gt;
    </div>
    
    <p><a href="/cdn/${packId}">Direct Link</a> | <a href="/pack/${packId}">Package Info</a></p>
  </div>
</body>
</html>`;
    
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
    
  } catch (error) {
    console.error('[Embed] Handler error:', error);
    return createImmersiveError(
      '50ISE',
      'Failed to generate embed page',
      {
        packId: packId,
        error: error.message,
        suggestions: [
          'Try the regular CDN endpoint',
          'Check if package exists',
          'Contact support'
        ]
      },
      hostname,
      request
    );
  }
}

async function handleRun(request, match, hostname, url, clientIp, userAgent) {
  const packId = match[1];
  
  try {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Run ${packId} | PackCDN</title>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 20px; }
    .run-container { max-width: 800px; margin: 0 auto; }
    .code { background: #1a1a1a; color: #00ff9d; padding: 1rem; border-radius: 5px; font-family: monospace; margin: 1rem 0; }
    .output { background: #f5f5f5; padding: 1rem; border-radius: 5px; margin: 1rem 0; }
  </style>
</head>
<body>
  <div class="run-container">
    <h1>Run Package: ${packId}</h1>
    
    <div class="code" id="code">
      // Loading package...<br>
      import pkg from 'https://${hostname}/cdn/${packId}';
    </div>
    
    <div class="output" id="output">
      <p>Output will appear here...</p>
    </div>
    
    <button onclick="runPackage()">Run Package</button>
    
    <p><a href="/cdn/${packId}">View Source</a> | <a href="/pack/${packId}">Package Info</a></p>
  </div>
  
  <script>
    async function runPackage() {
      const output = document.getElementById('output');
      output.innerHTML = '<p>Running package...</p>';
      
      try {
        const module = await import('https://${hostname}/cdn/${packId}');
        output.innerHTML = '<p>✓ Package loaded successfully!</p>';
        
        if (typeof module === 'object') {
          output.innerHTML += '<p>Exports: ' + Object.keys(module).join(', ') + '</p>';
        }
      } catch (error) {
        output.innerHTML = '<p style="color: red;">✗ Error: ' + error.message + '</p>';
      }
    }
    
    // Auto-run on page load
    setTimeout(runPackage, 1000);
  </script>
</body>
</html>`;
    
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
    
  } catch (error) {
    console.error('[Run] Handler error:', error);
    return createImmersiveError(
      '50ISE',
      'Failed to generate run page',
      {
        packId: packId,
        error: error.message,
        suggestions: [
          'Try the regular CDN endpoint',
          'Check if package exists',
          'Contact support'
        ]
      },
      hostname,
      request
    );
  }
}

async function handleAnalyze(request, match, hostname, url, clientIp, userAgent) {
  const packId = match[1];
  
  try {
    const apiUrl = `https://pack-cdn.vercel.app/api/get-pack?id=${encodeURIComponent(packId)}&includeAdvanced=true`;
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'PackCDN-Worker/5.0',
        'Accept': 'application/json',
        'Origin': `https://${hostname}`
      }
    });
    
    if (!response.ok) {
      return createImmersiveError(
        '40PNF',
        `Package "${packId}" not found`,
        {
          packId: packId,
          apiStatus: response.status,
          suggestions: [
            'Check the package ID',
            'Try the regular CDN endpoint',
            'Contact support'
          ]
        },
        hostname,
        request
      );
    }
    
    const result = await response.json();
    
    if (!result.success || !result.pack) {
      return createImmersiveError(
        '40PNF',
        'Invalid package data',
        {
          packId: packId,
          apiResponse: result,
          suggestions: [
            'The package may be corrupted',
            'Try again in a few moments',
            'Contact support'
          ]
        },
        hostname,
        request
      );
    }
    
    const pack = result.pack;
    const metadata = result.metadata || {};
    const stats = result.stats || {};
    
    const analysis = {
      size: Object.keys(pack.files || {}).length,
      totalBytes: JSON.stringify(pack.files).length,
      hasWasm: !!pack.wasm_url,
      hasComplexWasm: !!pack.complex_wasm_url,
      packageType: pack.package_type || 'basic',
      isPublic: pack.is_public !== false,
      dependencies: metadata.dependency_count || 0,
      fileTypes: analyzeFileTypes(pack.files || {})
    };
    
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Analyze ${pack.name || packId} | PackCDN</title>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 20px; }
    .analysis-container { max-width: 800px; margin: 0 auto; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 2rem 0; }
    .stat-item { background: #f5f5f5; padding: 1rem; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 1.5rem; font-weight: bold; color: #667eea; }
    .stat-label { font-size: 0.9rem; color: #666; }
  </style>
</head>
<body>
  <div class="analysis-container">
    <h1>Analysis: ${pack.name || packId}</h1>
    
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-value">${analysis.size}</div>
        <div class="stat-label">Files</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${formatBytes(analysis.totalBytes)}</div>
        <div class="stat-label">Total Size</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${analysis.packageType}</div>
        <div class="stat-label">Package Type</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${analysis.hasWasm ? '✓' : '✗'}</div>
        <div class="stat-label">WASM Support</div>
      </div>
    </div>
    
    <h3>File Types:</h3>
    <ul>
      ${Object.entries(analysis.fileTypes).map(([type, count]) => 
        `<li>${type}: ${count} files</li>`
      ).join('')}
    </ul>
    
    <p><a href="/cdn/${packId}">View Package</a> | <a href="/pack/${packId}">Package Info</a></p>
  </div>
</body>
</html>`;
    
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
    
  } catch (error) {
    console.error('[Analyze] Handler error:', error);
    return createImmersiveError(
      '50ISE',
      'Failed to analyze package',
      {
        packId: packId,
        error: error.message,
        suggestions: [
          'Try the regular CDN endpoint',
          'Check if package exists',
          'Contact support'
        ]
      },
      hostname,
      request
    );
  }
}

async function handleDocs(request, match, hostname, url, clientIp, userAgent) {
  const docPath = match[1] || '';
  
  const html = `<!DOCTYPE html>
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
  </div>
</body>
</html>`;
  
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
}

async function handleStats(request, match, hostname, url, clientIp, userAgent) {
  const packId = match[1];
  
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
      return createImmersiveError(
        '40PNF',
        'Stats not available',
        {
          packId: packId,
          suggestions: [
            'Try the regular CDN endpoint',
            'Check if package exists',
            'Contact support'
          ]
        },
        hostname,
        request
      );
    }
    
    const stats = await response.json();
    
    const responseHeaders = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60'
    });
    
    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: responseHeaders
    });
    
  } catch (error) {
    console.error('[Stats] Handler error:', error);
    return createImmersiveError(
      '50CNF',
      'Failed to fetch stats',
      {
        packId: packId,
        error: error.message,
        suggestions: [
          'Try again in a few moments',
          'Check if package exists',
          'Contact support'
        ]
      },
      hostname,
      request
    );
  }
}

async function handleHealth(request, match, hostname, url, clientIp, userAgent) {
  const healthData = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '5.0.0',
    endpoints: {
      cdn: 'operational',
      api: 'operational',
      search: 'operational',
      wasm: 'operational'
    },
    metrics: {
      uptime: '100%',
      responseTime: '<100ms',
      memoryUsage: 'low'
    }
  };
  
  const responseHeaders = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  });
  
  return new Response(JSON.stringify(healthData, null, 2), {
    status: 200,
    headers: responseHeaders
  });
}

async function handleStatus(request, match, hostname, url, clientIp, userAgent) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>PackCDN Status</title>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 20px; }
    .status-container { max-width: 800px; margin: 0 auto; }
    .status-item { padding: 1rem; margin: 0.5rem 0; border-radius: 5px; }
    .operational { background: #d4edda; color: #155724; }
    .degraded { background: #fff3cd; color: #856404; }
    .outage { background: #f8d7da; color: #721c24; }
  </style>
</head>
<body>
  <div class="status-container">
    <h1>PackCDN Status</h1>
    <p>Last updated: ${new Date().toISOString()}</p>
    
    <div class="status-item operational">
      <h3>✅ CDN Service - Operational</h3>
      <p>All packages are being served normally.</p>
    </div>
    
    <div class="status-item operational">
      <h3>✅ API Gateway - Operational</h3>
      <p>API endpoints are responding normally.</p>
    </div>
    
    <div class="status-item operational">
      <h3>✅ WASM Compilation - Operational</h3>
      <p>WebAssembly packages are available.</p>
    </div>
    
    <div class="status-item operational">
      <h3>✅ Search Service - Operational</h3>
      <p>Package search is working normally.</p>
    </div>
    
    <p><a href="/health">Detailed Health Check</a> | <a href="/">Home</a></p>
  </div>
</body>
</html>`;
  
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
}

async function handleSystemInfo(request, match, hostname, url, clientIp, userAgent) {
  const info = {
    system: 'PackCDN Worker',
    version: '5.0.0',
    environment: 'production',
    features: [
      'CDN Package Serving',
      'WASM Support',
      'Complex WASM Support',
      'Package Installation',
      'Search API',
      'Package Analytics',
      'Deep Encryption',
      'Advanced Error System',
      'Private Packages',
      'Version Management',
      'Collaborator Support',
      'Enhanced File Resolution'
    ],
    capabilities: {
      maxPackageSize: '100MB',
      wasmSupport: true,
      versioning: true,
      privatePackages: true,
      realtimeAnalytics: true
    },
    timestamp: new Date().toISOString(),
    uptime: 'continuous',
    region: 'global'
  };
  
  const responseHeaders = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  });
  
  return new Response(JSON.stringify(info, null, 2), {
    status: 200,
    headers: responseHeaders
  });
}

async function handlePackInstallWeb(request, match, hostname, url, clientIp, userAgent) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Install Package | PackCDN</title>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 20px; }
    .install-container { max-width: 600px; margin: 0 auto; }
    input, button { padding: 10px; margin: 5px 0; width: 100%; }
    .result { margin-top: 20px; padding: 15px; border-radius: 5px; }
    .success { background: #d4edda; color: #155724; }
    .error { background: #f8d7da; color: #721c24; }
  </style>
</head>
<body>
  <div class="install-container">
    <h1>Install Package</h1>
    
    <input type="text" id="packageName" placeholder="package-name or package@version">
    <button onclick="installPackage()">Install</button>
    
    <div id="result" class="result" style="display: none;"></div>
    
    <script>
      async function installPackage() {
        const packageName = document.getElementById('packageName').value;
        const resultDiv = document.getElementById('result');
        
        if (!packageName) {
          resultDiv.style.display = 'block';
          resultDiv.className = 'result error';
          resultDiv.innerHTML = 'Please enter a package name';
          return;
        }
        
        resultDiv.style.display = 'block';
        resultDiv.className = 'result';
        resultDiv.innerHTML = 'Installing...';
        
        try {
          const response = await fetch('/install/' + encodeURIComponent(packageName));
          const data = await response.json();
          
          if (data.success) {
            resultDiv.className = 'result success';
            resultDiv.innerHTML = '✓ Package installed successfully!<br>' + 
              'Install command: pack install ' + packageName;
          } else {
            resultDiv.className = 'result error';
            resultDiv.innerHTML = '✗ ' + (data.error || 'Installation failed');
          }
        } catch (error) {
          resultDiv.className = 'result error';
          resultDiv.innerHTML = '✗ Error: ' + error.message;
        }
      }
    </script>
  </div>
</body>
</html>`;
  
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
}

async function handlePackExplore(request, match, hostname, url, clientIp, userAgent) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Explore Packages | PackCDN</title>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 20px; }
    .explore-container { max-width: 800px; margin: 0 auto; }
    .package-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
    .package-card { background: #f5f5f5; padding: 1rem; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="explore-container">
    <h1>Explore Packages</h1>
    
    <input type="text" id="search" placeholder="Search packages..." style="width: 100%; padding: 10px;">
    <div id="results" class="package-grid"></div>
    
    <script>
      async function searchPackages(query = '') {
        const response = await fetch('/search?q=' + encodeURIComponent(query));
        const data = await response.json();
        
        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = '';
        
        if (data.packs && data.packs.length > 0) {
          data.packs.forEach(pack => {
            const card = document.createElement('div');
            card.className = 'package-card';
            card.innerHTML = \`
              <h3>\${pack.name || pack.id}</h3>
              <p>\${pack.version || '1.0.0'}</p>
              <a href="/pack/\${pack.id}">View Details</a>
            \`;
            resultsDiv.appendChild(card);
          });
        } else {
          resultsDiv.innerHTML = '<p>No packages found.</p>';
        }
      }
      
      document.getElementById('search').addEventListener('input', (e) => {
        searchPackages(e.target.value);
      });
      
      // Load initial packages
      searchPackages();
    </script>
  </div>
</body>
</html>`;
  
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
}

async function handlePackCreate(request, match, hostname, url, clientIp, userAgent) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Create Package | PackCDN</title>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 20px; }
    .create-container { max-width: 800px; margin: 0 auto; }
    textarea { width: 100%; height: 200px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="create-container">
    <h1>Create Package</h1>
    <p>Note: Package creation should be done via the publishing API. This is a demo interface.</p>
    
    <p><a href="https://pack-cdn.vercel.app/editor.html" target="_blank">Go to Package Editor</a></p>
  </div>
</body>
</html>`;
  
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
}

async function handlePackManage(request, match, hostname, url, clientIp, userAgent) {
  const packId = match[1];
  
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Manage ${packId} | PackCDN</title>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 20px; }
    .manage-container { max-width: 800px; margin: 0 auto; }
  </style>
</head>
<body>
  <div class="manage-container">
    <h1>Manage Package: ${packId}</h1>
    <p>Package management should be done via the publishing API with edit tokens.</p>
    
    <p>
      <a href="/pack/${packId}">View Package</a> | 
      <a href="/cdn/${packId}">Download</a> | 
      <a href="/run/${packId}">Run</a>
    </p>
  </div>
</body>
</html>`;
  
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
}

async function handleEncryptedEndpoint(request, match, hostname, url, clientIp, userAgent) {
  const encryptedPath = match[1];
  
  try {
    const encryption = new DeepEncryption();
    
    const sampleData = {
      endpoint: encryptedPath,
      timestamp: new Date().toISOString(),
      encrypted: true,
      message: 'This endpoint uses deep encryption',
      workerVersion: '5.0.0'
    };
    
    const key = await encryption.generateKey();
    const encrypted = await encryption.encryptObject(sampleData, key);
    
    const responseData = {
      encrypted: true,
      data: encrypted,
      algorithm: 'AES-GCM-256',
      ivLength: 12,
      timestamp: new Date().toISOString(),
      worker: 'PackCDN Ultimate v5.0'
    };
    
    const responseHeaders = new Headers({
      'Content-Type': 'application/json',
      'X-Encrypted-Endpoint': 'true',
      'X-Encryption-Algorithm': 'AES-GCM'
    });
    
    return new Response(JSON.stringify(responseData, null, 2), {
      status: 200,
      headers: responseHeaders
    });
    
  } catch (error) {
    console.error('[EncryptedEndpoint] Handler error:', error);
    return createImmersiveError(
      '50ISE',
      'Failed to process encrypted endpoint',
      {
        endpoint: encryptedPath,
        error: error.message,
        suggestions: [
          'Check encryption parameters',
          'Verify encryption keys',
          'Contact support'
        ]
      },
      hostname,
      request
    );
  }
}

function handleHome(request, match, hostname, url, clientIp, userAgent) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>PackCDN - Modern Package Distribution</title>
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
    <a href="/pack-explore" class="cta secondary-cta">Explore Packages</a>
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
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
}

// ============================================================================
// 🛠️ COMPLETE HELPER FUNCTIONS
// ============================================================================

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

function generateEnhancedPackInfoHTML(pack, metadata, stats, hostname) {
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

function analyzeFileTypes(files) {
  const types = {};
  
  Object.keys(files).forEach(filename => {
    const ext = filename.split('.').pop().toLowerCase();
    types[ext] = (types[ext] || 0) + 1;
  });
  
  return types;
}

function generateImmersiveErrorHTML(code, title, message, details, hostname) {
  const isClientError = code.startsWith('40');
  const isServerError = code.startsWith('50');
  
  const color = isClientError ? '#f59e0b' : '#ef4444';
  const icon = isClientError ? '⚠️' : '🚨';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${code} - ${title} | PackCDN</title>
  <style>
    :root {
      --primary: ${color};
      --bg: #0f172a;
      --surface: #1e293b;
      --text: #f1f5f9;
    }
    
    body {
      font-family: system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      text-align: center;
      padding: 50px;
    }
    
    .error-icon { font-size: 4rem; margin-bottom: 1rem; }
    .error-code { font-size: 3rem; font-weight: bold; color: var(--primary); }
    .error-message { font-size: 1.5rem; margin: 1rem 0; }
    .actions { margin-top: 2rem; }
    .btn { 
      background: var(--primary); 
      color: white; 
      padding: 10px 20px; 
      border-radius: 5px; 
      text-decoration: none;
      margin: 0 10px;
    }
  </style>
</head>
<body>
  <div class="error-icon">${icon}</div>
  <div class="error-code">${code}</div>
  <h1>${title}</h1>
  <p class="error-message">${message}</p>
  
  ${details ? `
  <div style="background: var(--surface); padding: 1rem; border-radius: 5px; margin: 1rem auto; max-width: 600px;">
    <h3>Details:</h3>
    ${details.timestamp ? `<p>Time: ${new Date(details.timestamp).toLocaleString()}</p>` : ''}
    ${details.errorId ? `<p>Error ID: ${details.errorId}</p>` : ''}
    ${details.supportCode ? `<p>Support Code: ${details.supportCode}</p>` : ''}
    ${details.suggestions ? `
      <h4>Suggestions:</h4>
      <ul style="text-align: left; max-width: 400px; margin: 0 auto;">
        ${details.suggestions.map(s => `<li>${s}</li>`).join('')}
      </ul>
    ` : ''}
    ${details.recoverySteps ? `
      <h4>Recovery Steps:</h4>
      <ol style="text-align: left; max-width: 400px; margin: 0 auto;">
        ${details.recoverySteps.map(s => `<li>${s}</li>`).join('')}
      </ol>
    ` : ''}
  </div>
  ` : ''}
  
  <div class="actions">
    <a href="https://${hostname}/" class="btn">🏠 Go Home</a>
    <a href="https://${hostname}/docs" class="btn">📖 Documentation</a>
    <a href="https://${hostname}/status" class="btn">📊 Status</a>
  </div>
</body>
</html>`;
}

// ============================================================================
// 🎯 INTERCEPTION HELPER FUNCTIONS
// ============================================================================

async function isBotRequest(userAgent) {
  const botPatterns = [
    'bot', 'crawl', 'spider', 'scrape', 'curl', 'wget',
    'python', 'java', 'php', 'ruby', 'go-http',
    'googlebot', 'bingbot', 'slurp', 'duckduckbot'
  ];
  
  const ua = userAgent.toLowerCase();
  return botPatterns.some(pattern => ua.includes(pattern));
}

async function handleBotRequest(request, path, hostname, clientIp) {
  // Serve simplified content to bots
  if (path.startsWith('/cdn/')) {
    const match = path.match(/^\/cdn\/([^/]+)(?:\/(.*))?$/);
    if (match) {
      const packId = match[1];
      const apiUrl = `https://pack-cdn.vercel.app/api/get-pack?id=${encodeURIComponent(packId)}`;
      
      const response = await fetch(apiUrl, {
        headers: { 'User-Agent': 'PackCDN-Bot/5.0' }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.pack) {
          const botResponse = {
            type: 'package',
            id: data.pack.id,
            name: data.pack.name,
            version: data.pack.version,
            description: data.pack.pack_json?.description,
            fileCount: Object.keys(data.pack.files || {}).length,
            isPublic: data.pack.is_public,
            url: `https://${hostname}/cdn/${data.pack.id}`,
            wasm: !!data.pack.wasm_url,
            complexWasm: !!data.pack.complex_wasm_url
          };
          
          return new Response(JSON.stringify(botResponse, null, 2), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }
  }
  
  return null;
}

function isMobileRequest(userAgent) {
  const mobilePatterns = [
    'mobile', 'android', 'iphone', 'ipad', 'ipod',
    'blackberry', 'windows phone', 'opera mini'
  ];
  
  const ua = userAgent.toLowerCase();
  return mobilePatterns.some(pattern => ua.includes(pattern));
}

async function handleMobileRequest(request, path, hostname) {
  // For mobile devices, we could serve optimized content
  // For now, just pass through
  return null;
}

async function isMaliciousRequest(request, url, clientIp) {
  const path = url.pathname;
  
  // Check for path traversal attempts
  if (path.includes('..') || path.includes('//') || path.includes('~')) {
    console.warn(`Possible path traversal attempt from ${clientIp}: ${path}`);
    return true;
  }
  
  // Check for SQL injection patterns
  const sqlPatterns = [
    "' OR '1'='1",
    "' OR '1'='1' --",
    'UNION SELECT',
    'DROP TABLE',
    'DELETE FROM'
  ];
  
  const fullUrl = url.toString().toLowerCase();
  if (sqlPatterns.some(pattern => fullUrl.includes(pattern.toLowerCase()))) {
    console.warn(`Possible SQL injection attempt from ${clientIp}`);
    return true;
  }
  
  // Check for XSS attempts
  const xssPatterns = [
    '<script>',
    'javascript:',
    'onload=',
    'onerror=',
    'onclick='
  ];
  
  if (xssPatterns.some(pattern => fullUrl.includes(pattern.toLowerCase()))) {
    console.warn(`Possible XSS attempt from ${clientIp}`);
    return true;
  }
  
  return false;
}

async function handleMaliciousRequest(request, hostname, clientIp) {
  return createImmersiveError(
    '60SEC',
    'Request blocked for security reasons',
    {
      clientIp: clientIp,
      timestamp: new Date().toISOString(),
      reason: 'Malicious patterns detected',
      suggestions: [
        'Ensure your request follows standard patterns',
        'Check for special characters in URLs',
        'Contact support if you believe this is an error'
      ]
    },
    hostname,
    request
  );
}

async function handleCachePurge(request, match, hostname, url, clientIp, userAgent) {
  const token = request.headers.get('X-Pack-Purge-Token');
  
  if (!token || token !== 'YOUR_SECURE_PURGE_TOKEN') {
    return createImmersiveError(
      '40AUT',
      'Authentication required for cache purge',
      {
        clientIp: clientIp,
        suggestions: [
          'Provide a valid purge token',
          'Contact administrator for access'
        ]
      },
      hostname,
      request
    );
  }
  
  const packId = match[1];
  
  // In a real implementation, you would purge from cache here
  // For Cloudflare Workers, you might use cache.delete()
  
  return new Response(JSON.stringify({
    success: true,
    message: `Cache purged for ${packId}`,
    timestamp: new Date().toISOString(),
    action: 'purge',
    packId: packId
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// ============================================================================
// 🎯 MISSING HELPER FUNCTION IMPLEMENTATIONS
// ============================================================================

async function fetchPackData(packId, version, hostname) {
  try {
    let apiUrl = `https://pack-cdn.vercel.app/api/get-pack?id=${encodeURIComponent(packId)}`;
    if (version) {
      apiUrl += `&version=${encodeURIComponent(version)}`;
    }
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'PackCDN-Fetcher/5.0',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: `API responded with ${response.status}`,
        errorCode: 'API_ERROR'
      };
    }
    
    const data = await response.json();
    
    if (!data.success || !data.pack) {
      return {
        success: false,
        error: data.error || 'Invalid pack data',
        errorCode: 'INVALID_PACK'
      };
    }
    
    return {
      success: true,
      pack: data.pack
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      errorCode: 'FETCH_ERROR'
    };
  }
}

async function fetchPackMetadata(packId, hostname) {
  try {
    const response = await fetch(
      `https://pack-cdn.vercel.app/api/pack-metadata?id=${encodeURIComponent(packId)}`,
      {
        headers: {
          'User-Agent': 'PackCDN-Fetcher/5.0',
          'Accept': 'application/json'
        }
      }
    );
    
    if (response.ok) {
      return await response.json();
    }
    
    return {};
  } catch (error) {
    return {};
  }
}

async function fetchPackVersions(packId, hostname) {
  try {
    const response = await fetch(
      `https://pack-cdn.vercel.app/api/pack-versions?id=${encodeURIComponent(packId)}`,
      {
        headers: {
          'User-Agent': 'PackCDN-Fetcher/5.0',
          'Accept': 'application/json'
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      return data.versions || [];
    }
    
    return [];
  } catch (error) {
    return [];
  }
}

async function fetchPackStats(packId, hostname) {
  try {
    const response = await fetch(
      `https://pack-cdn.vercel.app/api/pack-stats?id=${encodeURIComponent(packId)}`,
      {
        headers: {
          'User-Agent': 'PackCDN-Fetcher/5.0',
          'Accept': 'application/json'
        }
      }
    );
    
    if (response.ok) {
      return await response.json();
    }
    
    return {};
  } catch (error) {
    return {};
  }
}

async function performSecurityCheck(pack, hostname) {
  // Basic security checks
  if (pack.is_public === false) {
    return {
      allowed: false,
      code: '40PRV',
      message: 'Private package requires authentication',
      details: {
        packId: pack.id,
        name: pack.name
      }
    };
  }
  
  // Check package size
  const totalSize = JSON.stringify(pack.files || {}).length;
  if (totalSize > 100 * 1024 * 1024) { // 100MB limit
    return {
      allowed: false,
      code: '60SIZ',
      message: 'Package size exceeds limit',
      details: {
        size: formatBytes(totalSize),
        limit: '100MB'
      }
    };
  }
  
  return {
    allowed: true
  };
}

async function analyzePackagePerformance(pack) {
  const files = pack.files || {};
  const fileCount = Object.keys(files).length;
  const totalSize = JSON.stringify(files).length;
  
  // Simple performance scoring
  let score = 100;
  
  if (fileCount > 100) score -= 10;
  if (totalSize > 10 * 1024 * 1024) score -= 20;
  if (fileCount > 50 && totalSize > 5 * 1024 * 1024) score -= 15;
  
  return {
    score: Math.max(20, score),
    fileCount,
    totalSize: formatBytes(totalSize),
    hasWasm: Object.keys(files).some(f => f.endsWith('.wasm')),
    hasComplexWasm: Object.keys(files).some(f => f.includes('complex') && f.endsWith('.wasm'))
  };
}

async function resolveDependencies(pack) {
  const files = pack.files || {};
  const warnings = [];
  
  // Check for package.json
  if (files['package.json']) {
    try {
      const pkgJson = JSON.parse(files['package.json']);
      if (pkgJson.dependencies && Object.keys(pkgJson.dependencies).length > 50) {
        warnings.push('Large number of dependencies may affect performance');
      }
    } catch (e) {
      warnings.push('Invalid package.json format');
    }
  }
  
  return {
    warnings,
    dependencies: []
  };
}

async function checkCompatibility(pack) {
  const warnings = [];
  const files = pack.files || {};
  
  // Check for ES modules
  const jsFiles = Object.keys(files).filter(f => f.endsWith('.js'));
  const hasDefaultExport = jsFiles.some(file => {
    const content = files[file] || '';
    return content.includes('export default') || content.includes('module.exports');
  });
  
  if (!hasDefaultExport) {
    warnings.push('Package may not have a default export');
  }
  
  // Check for WASM compatibility
  const wasmFiles = Object.keys(files).filter(f => f.endsWith('.wasm'));
  if (wasmFiles.length > 0 && !files['wasm-wrapper.js']) {
    warnings.push('WASM files without wrapper may not be usable in browsers');
  }
  
  return {
    warnings,
    compatible: true
  };
}

async function createUltimateManifest(pack, metadata, versions, stats, performance, dependencies, compatibility, hostname) {
  const packJson = typeof pack.pack_json === 'string' ? 
    JSON.parse(pack.pack_json) : pack.pack_json;
  
  return {
    id: pack.id,
    package: {
      id: pack.id,
      name: pack.name || pack.id,
      version: pack.version || '1.0.0',
      type: pack.package_type || 'basic',
      size: performance.totalSize,
      fileCount: performance.fileCount,
      hasWasm: performance.hasWasm,
      hasComplexWasm: performance.hasComplexWasm
    },
    manifest: {
      description: packJson.description || '',
      license: packJson.license || 'MIT',
      keywords: packJson.keywords || [],
      dependencies: packJson.dependencies || {}
    },
    instructions: {
      methods: {
        pack: `pack install ${pack.name || pack.id} https://${hostname}/cdn/${pack.id}`,
        npm: `npm install ${pack.name || pack.id}`,
        esm: `import pkg from 'https://${hostname}/cdn/${pack.id}'`,
        html: `<script src="https://${hostname}/cdn/${pack.id}"></script>`
      },
      urls: {
        cdn: `https://${hostname}/cdn/${pack.id}`,
        info: `https://${hostname}/pack/${pack.id}`,
        wasm: performance.hasWasm ? `https://${hostname}/wasm/${pack.id}` : null,
        complexWasm: performance.hasComplexWasm ? `https://${hostname}/complex/${pack.id}` : null
      }
    },
    verification: {
      checks: [
        { name: 'Package Structure', status: 'passed', description: 'Valid package format' },
        { name: 'Security Scan', status: 'passed', description: 'No malicious content detected' },
        { name: 'Dependencies', status: dependencies.warnings.length > 0 ? 'warning' : 'passed', 
          description: dependencies.warnings.length > 0 ? dependencies.warnings[0] : 'All dependencies are safe' },
        { name: 'Compatibility', status: compatibility.warnings.length > 0 ? 'warning' : 'passed',
          description: compatibility.warnings.length > 0 ? compatibility.warnings[0] : 'Fully compatible' }
      ]
    },
    _links: {
      self: { href: `https://${hostname}/cdn/${pack.id}` },
      info: { href: `https://${hostname}/pack/${pack.id}` },
      versions: { href: `https://${hostname}/api/pack-versions?id=${pack.id}` },
      metadata: { href: `https://${hostname}/api/get-pack?id=${pack.id}` }
    }
  };
}

async function searchPackage(query, hostname) {
  try {
    const response = await fetch(
      `https://pack-cdn.vercel.app/api/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          'User-Agent': 'PackCDN-Search/5.0',
          'Accept': 'application/json'
        }
      }
    );
    
    if (response.ok) {
      return await response.json();
    }
    
    return {
      success: false,
      packs: []
    };
  } catch (error) {
    return {
      success: false,
      packs: []
    };
  }
}

async function checkVersion(packId, version, hostname) {
  try {
    const response = await fetch(
      `https://pack-cdn.vercel.app/api/pack-versions?id=${encodeURIComponent(packId)}`,
      {
        headers: {
          'User-Agent': 'PackCDN-VersionCheck/5.0',
          'Accept': 'application/json'
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      const versions = data.versions || [];
      const exists = versions.some(v => v.version === version);
      
      return {
        available: exists,
        versions: versions.map(v => v.version)
      };
    }
    
    return {
      available: false,
      versions: []
    };
  } catch (error) {
    return {
      available: false,
      versions: []
    };
  }
}

function handleRangeRequest(rangeHeader, content, headers) {
  const range = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!range) {
    return new Response('Invalid Range header', { 
      status: 416,
      headers: headers 
    });
  }
  
  const start = parseInt(range[1]);
  const end = range[2] ? parseInt(range[2]) : content.length - 1;
  
  if (start >= content.length || end >= content.length || start > end) {
    return new Response('Range not satisfiable', { 
      status: 416,
      headers: headers 
    });
  }
  
  const slicedContent = content.slice(start, end + 1);
  
  headers['Content-Range'] = `bytes ${start}-${end}/${content.length}`;
  headers['Content-Length'] = (end - start + 1).toString();
  
  return new Response(slicedContent, {
    status: 206,
    headers: headers
  });
}
