// api/wildcard-redirect.js
export default function handler(req, res) {
  const path = req.url;
  
  // Your actual files
  const destinations = [
    '/selector.html',
    '/home/index.html', 
    '/docs.html',
    '/editor.html',
    '/explore.html',
    '/config.json',
    '/Docs/docs.html',
    '/Editor/editor.html',
    '/Explore/explore.html',
    '/Login/login.html',
    '/Private/admin.html',
    '/Docs/Pages/Home/index.html',
    '/Docs/Pages/Home/Pages/Editor/editor.html',
    '/Docs/Pages/Home/Pages/Explore/explore.html',
    '/home/editor.html',
    '/home/explore.html'
  ];
  
  // Word banks for generating random URLs
  const wordBanks = {
    tech: ['quantum', 'cyber', 'digital', 'virtual', 'neural', 'synth', 'crypto', 'blockchain', 'ai', 'ml'],
    space: ['cosmic', 'stellar', 'galactic', 'orbital', 'lunar', 'solar', 'nebula', 'pulsar', 'quasar', 'wormhole'],
    nature: ['forest', 'ocean', 'mountain', 'river', 'crystal', 'ember', 'blaze', 'frost', 'storm', 'thunder'],
    fantasy: ['dragon', 'phoenix', 'wizard', 'arcane', 'mythic', 'legend', 'rune', 'spell', 'enchanted', 'magic'],
    future: ['neo', 'ultra', 'hyper', 'mega', 'tera', 'peta', 'omega', 'alpha', 'beta', 'gamma'],
    portals: ['gate', 'portal', 'door', 'window', 'bridge', 'tunnel', 'path', 'route', 'gateway', 'access'],
    places: ['nexus', 'hub', 'core', 'center', 'matrix', 'grid', 'network', 'web', 'cloud', 'cluster']
  };
  
  // Generate deterministic hash from path
  function getHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  // Generate a random-looking URL based on hash
  function generateRandomUrlFromHash(hashValue, pathStr) {
    const categories = Object.keys(wordBanks);
    const numWords = 2 + (hashValue % 3); // 2-4 words based on hash
    
    let randomPath = '/';
    for (let i = 0; i < numWords; i++) {
      const categoryIndex = (hashValue * (i + 1)) % categories.length;
      const category = categories[categoryIndex];
      const words = wordBanks[category];
      const wordIndex = (hashValue * (i + 2)) % words.length;
      const word = words[wordIndex];
      randomPath += word + (i < numWords - 1 ? '-' : '');
    }
    
    // Add variations based on hash
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
  
  // Check if this is a direct file access
  const isDirectFileAccess = destinations.some(file => 
    path === file || 
    path === file.replace('.html', '') ||
    path === file.replace('.html', '.json')
  );
  
  const hash = getHash(path);
  const destinationIndex = hash % destinations.length;
  const destination = destinations[destinationIndex];
  
  // If someone tries to access a file directly, generate a random URL for it
  if (isDirectFileAccess) {
    const randomUrl = generateRandomUrlFromHash(hash, path);
    
    console.log(`🔒 Encrypting direct access: ${path} -> Generated URL: ${randomUrl}`);
    
    // Create a permanent redirect to the random URL
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-URL-Encrypted', 'true');
    res.setHeader('X-Original-Path', path);
    res.setHeader('X-Encrypted-URL', randomUrl);
    res.setHeader('X-File-Hash', hash.toString());
    
    // 301 Permanent redirect to the random URL
    return res.redirect(301, randomUrl);
  }
  
  // For any other path, redirect to a destination
  console.log(`🎲 Random redirect: ${path} -> ${destination} (Hash: ${hash})`);
  
  // Generate what the encrypted URL would be for this destination
  const encryptedUrl = generateRandomUrlFromHash(hash, destination);
  
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Random-Redirect', 'true');
  res.setHeader('X-Destination', destination);
  res.setHeader('X-Encrypted-Version', encryptedUrl);
  res.setHeader('X-Path-Hash', hash.toString());
  
  // Show a fun page with the redirect info
  if (path.includes('show-info')) {
    return res.json({
      message: 'Random URL System Active',
      requestedPath: path,
      destination: destination,
      encryptedUrl: encryptedUrl,
      hash: hash,
      redirectUrl: `https://pack-cdn.vercel.app${encryptedUrl}`,
      systemInfo: {
        totalDestinations: destinations.length,
        wordCategories: Object.keys(wordBanks).length,
        totalWordVariations: Object.values(wordBanks).reduce((sum, arr) => sum + arr.length, 0),
        possibleCombinations: 'Infinite (generated on-demand)'
      }
    });
  }
  
  // Normal redirect to the actual file
  return res.redirect(302, destination);
}
