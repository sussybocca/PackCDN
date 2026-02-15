import { createClient } from '@vercel/edge-config';

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /down.html (the maintenance page itself)
     * - /down-docs (detailed docs page)
     * - /api/health (internal health checks)
     * - /_vercel (Vercel internals)
     * - /static (static files)
     * - /favicon.ico, /robots.txt (common files)
     */
    '/((?!down\\.html|down-docs|api/health|_vercel|static|favicon\\.ico|robots\\.txt).*)',
  ],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const startTime = Date.now();

  console.log(`[${new Date().toISOString()}] ${request.method} ${url.pathname}`);

  const edgeConfig = createClient(process.env.EDGE_CONFIG);

  try {
    // Fetch both site_down and bugInfo from Edge Config
    const [siteDown, bugInfo] = await Promise.all([
      edgeConfig.get('site_down'),
      edgeConfig.get('bugInfo'),
    ]);

    // If site is down, serve the maintenance page
    if (siteDown === true) {
      // Fetch the maintenance page from the same origin
      const maintenanceUrl = new URL('/down.html', request.url);
      const maintenanceResponse = await fetch(maintenanceUrl);

      // Clone and add maintenance headers
      const newResponse = new Response(maintenanceResponse.body, maintenanceResponse);
      newResponse.headers.set('X-Maintenance-Mode', 'active');
      if (bugInfo?.message) {
        newResponse.headers.set('X-Maintenance-Reason', bugInfo.message);
      }
      newResponse.headers.set('Cache-Control', 'private, max-age=10');

      console.log(`[MAINTENANCE] ${url.pathname} → /down.html (${Date.now() - startTime}ms)`);
      return newResponse;
    }

    // Normal request: fetch the actual asset and add timing header
    const response = await fetch(request);
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-Edge-Response-Time', `${Date.now() - startTime}ms`);
    return newResponse;

  } catch (error) {
    // Edge Config unreachable – fallback to normal routing with error header
    console.error(`Edge Config error for ${url.pathname}:`, error.message);
    const response = await fetch(request);
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-Edge-Config-Error', 'unreachable');
    return newResponse;
  }
}
