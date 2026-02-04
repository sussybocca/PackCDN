// api/wildcard-redirect.js
export default function handler(req, res) {
  const fullPath = req.url;
  const path = fullPath.split('?')[0];
  
  console.log(`🌐 API Processing: ${path}`);
  
  // All your files
  const allFiles = [
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
    '/selector.html'
  ];
  
  // Massive word banks for infinite @username generation
  const wordBanks = {
    tech: ['quantum', 'cyber', 'digital', 'virtual', 'neural', 'synth', 'crypto', 'blockchain', 'ai', 'ml', 'bot', 'chip', 'data', 'cloud', 'node', 'server'],
    space: ['cosmic', 'stellar', 'galactic', 'orbital', 'lunar', 'solar', 'nebula', 'pulsar', 'quasar', 'wormhole', 'void', 'singularity', 'event-horizon', 'supernova', 'comet', 'asteroid'],
    nature: ['forest', 'ocean', 'mountain', 'river', 'crystal', 'ember', 'blaze', 'frost', 'storm', 'thunder', 'leaf', 'stone', 'fire', 'ice', 'water', 'earth'],
    fantasy: ['dragon', 'phoenix', 'wizard', 'arcane', 'mythic', 'legend', 'rune', 'spell', 'enchanted', 'magic', 'knight', 'castle', 'realm', 'scroll', 'orb', 'tome'],
    future: ['neo', 'ultra', 'hyper', 'mega', 'tera', 'peta', 'omega', 'alpha', 'beta', 'gamma', 'delta', 'sigma', 'zeta', 'theta', 'lambda', 'epsilon'],
    portals: ['gate', 'portal', 'door', 'window', 'bridge', 'tunnel', 'path', 'route', 'gateway', 'access', 'entry', 'exit', 'passage', 'corridor', 'archway', 'threshold'],
    places: ['nexus', 'hub', 'core', 'center', 'matrix', 'grid', 'network', 'web', 'cloud', 'cluster', 'node', 'terminal', 'station', 'outpost', 'haven', 'sanctuary'],
    cosmic: ['constellation', 'galaxy', 'universe', 'multiverse', 'dimension', 'reality', 'plane', 'existence', 'infinity', 'eternity', 'singularity', 'infinity', 'cosmos', 'void'],
    digital: ['binary', 'byte', 'pixel', 'render', 'stream', 'buffer', 'cache', 'memory', 'storage', 'server', 'client', 'protocol', 'packet', 'bandwidth', 'fiber', 'wireless'],
    gaming: ['player', 'quest', 'level', 'boss', 'loot', 'xp', 'skill', 'gear', 'raid', 'dungeon', 'pvp', 'pve', 'grind', 'farm', 'guild', 'arena'],
    sciFi: ['android', 'cyborg', 'laser', 'plasma', 'warp', 'teleport', 'hologram', 'drone', 'nanobot', 'exosuit', 'forcefield', 'phaser', 'transporter', 'replicator', 'holodeck', 'warpdrive']
  };
  
  // Hash function for deterministic generation
  function getHash(str, seed = 5381) {
    let hash = seed;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  // Generate @username from hash
  function generateAtUsername(hashValue) {
    const categories = Object.keys(wordBanks);
    const numWords = 1 + (hashValue % 2); // 1-2 words for clean @usernames
    
    let username = '';
    for (let i = 0; i < numWords; i++) {
      const categoryIndex = (hashValue * (i + 1)) % categories.length;
      const category = categories[categoryIndex];
      const words = wordBanks[category];
      const wordIndex = (hashValue * (i + 2)) % words.length;
      const word = words[wordIndex];
      
      // Capitalize first letter for @username style
      username += word.charAt(0).toUpperCase() + word.slice(1);
    }
    
    // Add suffix sometimes
    const suffixes = ['', 'X', 'Pro', 'Max', 'HD', 'VR', 'AI', '360', 'V2', 'Ultra', 'Plus', 'Prime'];
    const suffixIndex = (hashValue * 7) % suffixes.length;
    if (suffixes[suffixIndex]) {
      username += suffixes[suffixIndex];
    }
    
    // Sometimes add numbers (30% chance)
    if (hashValue % 10 < 3) {
      username += (hashValue % 1000);
    }
    
    return '@' + username;
  }
  
  const hash = getHash(path);
  
  // Predefined @username mappings (from your vercel.json)
  const predefinedMappings = {
    // @username -> file
    '/@quantum': '/selector.html',
    '/@cosmic': '/home/index.html',
    '/@digital': '/docs.html',
    '/@neo': '/editor.html',
    '/@virtual': '/explore.html',
    '/@synth': '/config.json',
    '/@stellar': '/Docs/docs.html',
    '/@cyber': '/Editor/editor.html',
    '/@orbital': '/Explore/explore.html',
    '/@dragon': '/Login/login.html',
    '/@phoenix': '/Private/admin.html',
    '/@homecore': '/Docs/Pages/Home/index.html',
    '/@editornetwork': '/Docs/Pages/Home/Pages/Editor/editor.html',
    '/@explorervortex': '/Docs/Pages/Home/Pages/Explore/explore.html',
    '/@homestudio': '/home/editor.html',
    '/@homediscovery': '/home/explore.html'
  };
  
  // Reverse mapping: file -> @username
  const fileToUsername = {};
  Object.entries(predefinedMappings).forEach(([username, file]) => {
    fileToUsername[file] = username;
  });
  
  // Check if this is a file path that should redirect to @username
  if (allFiles.includes(path)) {
    // Check if we have a predefined @username for this file
    if (fileToUsername[path]) {
      const username = fileToUsername[path];
      console.log(`📄 File access: ${path} -> ${username} (predefined)`);
      
      // 301 Permanent redirect to @username
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      res.setHeader('X-Redirect-To-Username', username);
      res.setHeader('X-Original-File', path);
      
      return res.redirect(301, username);
    }
    
    // Generate a new @username for this file
    const newUsername = '/' + generateAtUsername(hash);
    console.log(`📄 File access: ${path} -> ${newUsername} (generated)`);
    
    // Store this mapping
    predefinedMappings[newUsername] = path;
    fileToUsername[path] = newUsername;
    
    // 301 Permanent redirect to new @username
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Redirect-To-Username', newUsername);
    res.setHeader('X-Original-File', path);
    res.setHeader('X-New-Mapping', 'true');
    
    return res.redirect(301, newUsername);
  }
  
  // Check if this is a known @username
  if (predefinedMappings[path]) {
    const targetFile = predefinedMappings[path];
    console.log(`👤 @username access: ${path} -> ${targetFile}`);
    
    // Serve the actual file (URL stays as @username)
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Serving-File', targetFile);
    res.setHeader('X-Username', path);
    
    return res.redirect(302, targetFile);
  }
  
  // Handle dynamic @usernames (paths starting with /@)
  if (path.startsWith('/@')) {
    // Generate deterministic mapping for this new @username
    const targetIndex = hash % allFiles.length;
    const targetFile = allFiles[targetIndex];
    
    // Store this new mapping
    predefinedMappings[path] = targetFile;
    fileToUsername[targetFile] = path;
    
    console.log(`✨ Dynamic @username: ${path} -> ${targetFile}`);
    
    // Serve the file
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Dynamic-Mapping', 'true');
    res.setHeader('X-Serving-File', targetFile);
    
    return res.redirect(302, targetFile);
  }
  
  // System info endpoint
  if (path === '/system-info' || path === '/url-system-info') {
    const totalMappings = Object.keys(predefinedMappings).length;
    const atUsernames = Object.keys(predefinedMappings).filter(k => k.startsWith('/@'));
    
    // Generate sample @usernames
    const sampleUsernames = [];
    for (let i = 0; i < 10; i++) {
      const sampleHash = getHash(`sample-${i}-${Date.now()}`);
      sampleUsernames.push(generateAtUsername(sampleHash));
    }
    
    return res.json({
      system: '@Username URL System',
      status: 'active',
      totalFiles: allFiles.length,
      totalMappings: totalMappings,
      predefinedUsernames: atUsernames.length,
      wordCategories: Object.keys(wordBanks).length,
      totalWords: Object.values(wordBanks).reduce((sum, arr) => sum + arr.length, 0),
      sampleGeneratedUsernames: sampleUsernames,
      mappings: Object.entries(predefinedMappings).slice(0, 15),
      usage: 'Any /@username will map to a file. File paths redirect to @usernames.'
    });
  }
  
  // Generate test page
  if (path === '/generate-test' || path.includes('test')) {
    const generated = [];
    for (let i = 0; i < 25; i++) {
      const testHash = getHash(`test${i}${Date.now()}`);
      generated.push({
        username: generateAtUsername(testHash),
        wouldMapTo: allFiles[testHash % allFiles.length]
      });
    }
    
    return res.json({
      action: '@username-generation-test',
      generated: generated,
      note: 'These are sample @usernames that would be created'
    });
  }
  
  // For any other path, redirect to a random file via @username
  const targetIndex = hash % allFiles.length;
  const targetFile = allFiles[targetIndex];
  
  // Check if this file already has an @username
  let username = fileToUsername[targetFile];
  if (!username) {
    // Generate new @username for this file
    username = '/' + generateAtUsername(hash);
    predefinedMappings[username] = targetFile;
    fileToUsername[targetFile] = username;
  }
  
  console.log(`🚀 Random path: ${path} -> ${username} -> ${targetFile}`);
  
  // Redirect to the @username
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Generated-Username', username);
  res.setHeader('X-Target-File', targetFile);
  
  return res.redirect(302, username);
}
