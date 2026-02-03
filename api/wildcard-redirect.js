// api/wildcard-redirect.js
export default function handler(req, res) {
  const path = req.url;
  
  // All your actual files from the build output
  const destinations = [
    // Main pages
    '/selector.html',
    '/home/index.html',
    '/docs.html',
    '/editor.html', 
    '/explore.html',
    '/config.json',
    
    // Alternative paths
    '/Docs/docs.html',
    '/Editor/editor.html',
    '/Explore/explore.html',
    '/Login/login.html',
    '/Private/admin.html',
    
    // Nested pages
    '/Docs/Pages/Home/index.html',
    '/Docs/Pages/Home/Pages/Editor/editor.html',
    '/Docs/Pages/Home/Pages/Explore/explore.html',
    '/home/editor.html',
    '/home/explore.html'
  ];
  
  const destinationNames = [
    'Home Selector',
    'Dashboard',
    'Documentation',
    'Editor',
    'Explorer',
    'Configuration',
    'Docs Alternative',
    'Editor Alternative',
    'Explore Alternative',
    'Login Page',
    'Admin Panel',
    'Home Page',
    'Editor Page',
    'Explore Page',
    'Home Editor',
    'Home Explorer'
  ];
  
  // Deterministic redirect based on path hash
  function getHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  const hash = getHash(path);
  const index = hash % destinations.length;
  const destination = destinations[index];
  const destinationName = destinationNames[index];
  
  // Skip redirect for actual files and API routes
  const skipRedirect = [
    '/api/',
    '/config.json',
    '.js',
    '.css',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.ico',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot'
  ];
  
  // Check if this is an actual file request
  const isActualFile = destinations.includes(path) || 
                      skipRedirect.some(ext => path.includes(ext));
  
  // Fun log messages
  const funLogs = [
    `🌌 Quantum tunnel: ${path} → ${destinationName}`,
    `🚀 Warp drive engaged! ${path}`,
    `🔮 Crystal ball shows: ${destinationName}`,
    `🎲 Rolled: ${path} → ${destinationName}`,
    `🌀 Temporal anomaly at ${path}`,
    `⚡ Energy surge to ${destinationName}`,
    `🌈 Rainbow leads to ${destinationName}`,
    `🎯 Bullseye! ${path} → ${destinationName}`,
    `🧭 Compass points to ${destinationName}`,
    `🎪 Carnival route: ${path} → ${destinationName}`,
    `🪐 Cosmic journey: ${path} → ${destinationName}`,
    `🔭 Telescope focused on ${destinationName}`,
    `🧪 Experiment redirects to ${destinationName}`,
    `🛸 UFO beam targeting ${destinationName}`,
    `🎭 Theater performance: ${path} → ${destinationName}`
  ];
  
  const logIndex = hash % funLogs.length;
  
  if (!isActualFile) {
    console.log(`${funLogs[logIndex]} (Hash: ${hash}, Index: ${index})`);
    
    // Set fun headers
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Random-Redirect', 'true');
    res.setHeader('X-Destination', destination);
    res.setHeader('X-Destination-Name', destinationName);
    res.setHeader('X-Hash', hash.toString());
    res.setHeader('X-Original-Path', path);
    
    return res.redirect(302, destination);
  }
  
  // For actual files, let them be served normally
  // (This shouldn't happen since actual files should match before this rewrite)
  return res.status(404).json({
    error: 'Not found',
    message: 'This is a wildcard redirect handler',
    availableDestinations: destinations,
    tip: 'Try a random path like /quantum-portal or /cosmic-library'
  });
}
