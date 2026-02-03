// api/wildcard-redirect.js
export default function handler(req, res) {
  const path = req.url.split('?')[0];
  
  // Map of actual files to their fun URL names
  const fileToFunUrl = {
    // Core files
    '/selector.html': 'quantum-portal',
    '/home/index.html': 'cosmic-dashboard',
    '/docs.html': 'digital-library',
    '/editor.html': 'neo-workshop',
    '/explore.html': 'virtual-explorer',
    '/config.json': 'synth-config',
    
    // Docs files
    '/Docs/docs.html': 'stellar-docs',
    '/Docs/Pages/Home/index.html': 'home-core',
    '/Docs/Pages/Home/Pages/Editor/editor.html': 'editor-nexus',
    '/Docs/Pages/Home/Pages/Explore/explore.html': 'explore-gateway',
    
    // Editor files
    '/editor.html': 'cyber-studio',
    '/Editor/editor.html': 'arcane-editor',
    
    // Explore files
    '/explore.html': 'orbital-discovery',
    '/Explore/explore.html': 'celestial-explorer',
    
    // Auth files
    '/Login/login.html': 'dragon-login',
    '/Private/admin.html': 'phoenix-admin',
    
    // Home files
    '/home/editor.html': 'home-studio',
    '/home/explore.html': 'home-discovery',
    '/selector.html': 'home-portal'
  };
  
  // Reverse map: fun URL back to file
  const funUrlToFile = {};
  for (const [file, funName] of Object.entries(fileToFunUrl)) {
    funUrlToFile['/' + funName] = file;
    // Add variations
    funUrlToFile['/' + funName + '-v1'] = file;
    funUrlToFile['/' + funName + '-v2'] = file;
    funUrlToFile['/' + funName + '-v3'] = file;
    funUrlToFile['/api/' + funName] = file;
    funUrlToFile['/v1/' + funName] = file;
    funUrlToFile['/v2/' + funName] = file;
  }
  
  // Word banks for generating MORE fun URLs
  const wordBanks = {
    tech: ['quantum', 'cyber', 'digital', 'virtual', 'neural', 'synth', 'crypto', 'blockchain', 'ai', 'ml'],
    space: ['cosmic', 'stellar', 'galactic', 'orbital', 'lunar', 'solar', 'nebula', 'pulsar', 'quasar', 'wormhole'],
    nature: ['forest', 'ocean', 'mountain', 'river', 'crystal', 'ember', 'blaze', 'frost', 'storm', 'thunder'],
    fantasy: ['dragon', 'phoenix', 'wizard', 'arcane', 'mythic', 'legend', 'rune', 'spell', 'enchanted', 'magic'],
    future: ['neo', 'ultra', 'hyper', 'mega', 'tera', 'peta', 'omega', 'alpha', 'beta', 'gamma'],
    portals: ['gate', 'portal', 'door', 'window', 'bridge', 'tunnel', 'path', 'route', 'gateway', 'access'],
    places: ['nexus', 'hub', 'core', 'center', 'matrix', 'grid', 'network', 'web', 'cloud', 'cluster']
  };
  
  // Generate hash for deterministic fun URLs
  function getHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  // Check if this is a file that has a fun URL mapping
  if (fileToFunUrl[path]) {
    const funName = fileToFunUrl[path];
    const funUrl = '/' + funName + '-v' + ((getHash(path) % 5) + 1);
    
    console.log(`🔗 ${path} has fun URL: ${funUrl}`);
    
    // PERMANENT redirect to fun URL (301)
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Fun-URL', funUrl);
    res.setHeader('X-Original-File', path);
    
    return res.redirect(301, funUrl);
  }
  
  // Check if this is a fun URL that maps to a file
  if (funUrlToFile[path]) {
    const targetFile = funUrlToFile[path];
    
    console.log(`🎉 Fun URL ${path} → ${targetFile}`);
    
    // Serve the actual file (via redirect since it exists as static file)
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Serving-File', targetFile);
    
    return res.redirect(302, targetFile);
  }
  
  // Generate a NEW fun URL for any unknown path
  const hash = getHash(path);
  const categories = Object.keys(wordBanks);
  const numWords = 2 + (hash % 3);
  
  let generatedFunUrl = '/';
  for (let i = 0; i < numWords; i++) {
    const catIndex = (hash * (i + 1)) % categories.length;
    const category = categories[catIndex];
    const words = wordBanks[category];
    const wordIndex = (hash * (i + 2)) % words.length;
    generatedFunUrl += words[wordIndex] + (i < numWords - 1 ? '-' : '');
  }
  
  // Add version
  generatedFunUrl += '-v' + ((hash % 10) + 1);
  
  // Pick a random file to map this new fun URL to
  const allFiles = Object.keys(fileToFunUrl);
  const fileIndex = hash % allFiles.length;
  const mappedFile = allFiles[fileIndex];
  
  // Store the mapping
  funUrlToFile[generatedFunUrl] = mappedFile;
  
  console.log(`✨ Generated new fun URL: ${path} → ${generatedFunUrl} → ${mappedFile}`);
  
  // Redirect to show what would happen
  if (path.includes('show')) {
    return res.json({
      system: 'Fun URL Transformer',
      originalPath: path,
      generatedFunUrl: generatedFunUrl,
      mapsToFile: mappedFile,
      totalMappings: Object.keys(funUrlToFile).length,
      exampleFunUrls: Object.keys(funUrlToFile).slice(0, 10)
    });
  }
  
  // Redirect to the actual file
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Generated-Fun-URL', generatedFunUrl);
  
  return res.redirect(302, mappedFile);
}
