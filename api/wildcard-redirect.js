// api/wildcard-redirect.js
export default function handler(req, res) {
  const path = req.url;
  
  const destinations = [
    '/config.json',
    '/docs.html',
    '/Docs/docs.html',
    '/Docs/Pages/Home/index.html',
    '/Docs/Pages/Home/Pages/Editor/editor.html',
    '/Docs/Pages/Home/Pages/Explore/explore.html',
    '/editor.html',
    '/Editor/editor.html',
    '/explore.html',
    '/Explore/explore.html',
    '/home/editor.html',
    '/home/explore.html',
    '/home/index.html',
    '/Login/login.html',
    '/Private/admin.html',
    '/selector.html',
    '/api/admin/database',
    '/api/analyze',
    '/api/get-pack',
    '/api/login',
    '/api/publish',
    '/api/random-urls',
    '/api/search',
    '/api/session-generate',
    '/api/wildcard-redirect'
  ];
  
  const wordBanks = {
    tech: ['quantum', 'cyber', 'digital', 'virtual', 'neural', 'synth', 'crypto', 'blockchain', 'ai', 'ml'],
    space: ['cosmic', 'stellar', 'galactic', 'orbital', 'lunar', 'solar', 'nebula', 'pulsar', 'quasar', 'wormhole'],
    nature: ['forest', 'ocean', 'mountain', 'river', 'crystal', 'ember', 'blaze', 'frost', 'storm', 'thunder'],
    fantasy: ['dragon', 'phoenix', 'wizard', 'arcane', 'mythic', 'legend', 'rune', 'spell', 'enchanted', 'magic'],
    future: ['neo', 'ultra', 'hyper', 'mega', 'tera', 'peta', 'omega', 'alpha', 'beta', 'gamma'],
    portals: ['gate', 'portal', 'door', 'window', 'bridge', 'tunnel', 'path', 'route', 'gateway', 'access'],
    places: ['nexus', 'hub', 'core', 'center', 'matrix', 'grid', 'network', 'web', 'cloud', 'cluster']
  };
  
  function getHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  function generateRandomUrlFromHash(hashValue, pathStr) {
    const categories = Object.keys(wordBanks);
    const numWords = 2 + (hashValue % 3);
    
    let randomPath = '/';
    for (let i = 0; i < numWords; i++) {
      const categoryIndex = (hashValue * (i + 1)) % categories.length;
      const category = categories[categoryIndex];
      const words = wordBanks[category];
      const wordIndex = (hashValue * (i + 2)) % words.length;
      const word = words[wordIndex];
      randomPath += word + (i < numWords - 1 ? '-' : '');
    }
    
    const variations = [
      () => randomPath + '-v' + ((hashValue % 10) + 1),
      () => randomPath + (hashValue % 1000),
      () => randomPath + '-' + hashValue.toString(36).slice(0, 6),
      () => '/api/' + randomPath.slice(1),
      () => '/v' + ((hashValue % 3) + 1) + randomPath,
      () => randomPath,
      () => randomPath + '-gateway',
      () => randomPath + '-portal',
      () => randomPath + '-access'
    ];
    
    const variationIndex = hashValue % variations.length;
    return variations[variationIndex]();
  }
  
  const hasFileExtension = /\.[a-zA-Z0-9]+$/.test(path);
  const isApiPath = path.startsWith('/api/');
  
  const hash = getHash(path);
  const destinationIndex = hash % destinations.length;
  const destination = destinations[destinationIndex];
  
  if (hasFileExtension && !isApiPath) {
    const randomUrl = generateRandomUrlFromHash(hash, path);
    
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-URL-Encrypted', 'true');
    res.setHeader('X-Original-Path', path);
    res.setHeader('X-Encrypted-URL', randomUrl);
    res.setHeader('X-File-Hash', hash.toString());
    
    return res.redirect(301, randomUrl);
  }
  
  const specialRoutes = {
    '/': '/selector.html',
    '/home': '/home/index.html',
    '/docs': '/docs.html',
    '/editor': '/editor.html',
    '/explore': '/explore.html',
    '/portal': '/selector.html',
    '/gateway': '/home/index.html',
    '/library': '/docs.html',
    '/workshop': '/editor.html',
    '/discover': '/explore.html',
    '/settings': '/config.json'
  };
  
  if (specialRoutes[path]) {
    return res.redirect(302, specialRoutes[path]);
  }
  
  if (isApiPath) {
    return res.redirect(302, destination);
  }
  
  const encryptedUrl = generateRandomUrlFromHash(hash, destination);
  
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Random-Redirect', 'true');
  res.setHeader('X-Destination', destination);
  res.setHeader('X-Encrypted-Version', encryptedUrl);
  res.setHeader('X-Path-Hash', hash.toString());
  
  if (path.includes('show-info')) {
    return res.json({
      message: 'Random URL System Active',
      requestedPath: path,
      destination: destination,
      encryptedUrl: encryptedUrl,
      hash: hash
    });
  }
  
  return res.redirect(302, destination);
}
