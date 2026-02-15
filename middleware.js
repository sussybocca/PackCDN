// middleware.js
import { createClient } from '@vercel/edge-config';

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - down-docs (the detailed docs page)
     * - api/health (internal health checks)
     * - _vercel (Vercel internal)
     * - static (static files)
     * - favicon.ico, robots.txt (common files)
     */
    '/((?!down-docs|api/health|_vercel|static|favicon.ico|robots.txt).*)',
  ],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const startTime = Date.now();

  // Log request (you can send this to an external service like Logtail, Axiom, etc.)
  console.log(`[${new Date().toISOString()}] ${request.method} ${url.pathname}`);

  const edgeConfig = createClient(process.env.EDGE_CONFIG);

  try {
    // Fetch both site_down and bugInfo in parallel
    const [siteDown, bugInfo] = await Promise.all([
      edgeConfig.get('site_down'),
      edgeConfig.get('bugInfo'),
    ]);

    // If site is down, rewrite to down.html, but also add custom headers
    if (siteDown === true) {
      // Clone the response so we can add headers
      const response = await next({ rewrite: '/down.html' });
      const newResponse = new Response(response.body, response);

      // Add headers to indicate maintenance mode
      newResponse.headers.set('X-Maintenance-Mode', 'active');
      if (bugInfo?.message) {
        newResponse.headers.set('X-Maintenance-Reason', bugInfo.message);
      }
      // Cache for a very short time to avoid stale headers
      newResponse.headers.set('Cache-Control', 'private, max-age=10');

      // Log that we served maintenance page
      console.log(`[MAINTENANCE] ${url.pathname} → /down.html (${Date.now() - startTime}ms)`);
      return newResponse;
    }

    // Optional: Add timing header for debugging
    const response = await next();
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-Edge-Response-Time', `${Date.now() - startTime}ms`);
    return newResponse;

  } catch (error) {
    // Edge Config is unreachable – fallback to normal routing, but log error
    console.error(`Edge Config error for ${url.pathname}:`, error.message);

    // You might want to still serve the site, but with a warning header
    const response = await next();
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-Edge-Config-Error', 'unreachable');
    return newResponse;
  }
}
