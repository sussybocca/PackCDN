// api/wildcard-redirect.js
export default function handler(req, res) {
  const fullPath = req.url;
  const path = fullPath.split('?')[0];
  
  console.log(`🌐 Processing: ${path}`);
  
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
  
  // Massive word banks for infinite fun URL generation
  const wordBanks = {
    tech: ['quantum', 'cyber', 'digital', 'virtual', 'neural', 'synth', 'crypto', 'blockchain', 'ai', 'ml', 'bot', 'chip', 'data', 'cloud'],
    space: ['cosmic', 'stellar', 'galactic', 'orbital', 'lunar', 'solar', 'nebula', 'pulsar', 'quasar', 'wormhole', 'void', 'singularity', 'event-horizon', 'supernova'],
    nature: ['forest', 'ocean', 'mountain', 'river', 'crystal', 'ember', 'blaze', 'frost', 'storm', 'thunder', 'leaf', 'stone', 'fire', 'ice'],
    fantasy: ['dragon', 'phoenix', 'wizard', 'arcane', 'mythic', 'legend', 'rune', 'spell', 'enchanted', 'magic', 'knight', 'castle', 'realm', 'scroll'],
    future: ['neo', 'ultra', 'hyper', 'mega', 'tera', 'peta', 'omega', 'alpha', 'beta', 'gamma', 'delta', 'sigma', 'zeta', 'theta'],
    portals: ['gate', 'portal', 'door', 'window', 'bridge', 'tunnel', 'path', 'route', 'gateway', 'access', 'entry', 'exit', 'passage', 'corridor'],
    places: ['nexus', 'hub', 'core', 'center', 'matrix', 'grid', 'network', 'web', 'cloud', 'cluster', 'node', 'terminal', 'station', 'outpost'],
    cosmic: ['constellation', 'galaxy', 'universe', 'multiverse', 'dimension', 'reality', 'plane', 'existence', 'infinity', 'eternity', 'singularity', 'infinity'],
    digital: ['binary', 'byte', 'pixel', 'render', 'stream', 'buffer', 'cache', 'memory', 'storage', 'server', 'client', 'protocol', 'packet', 'bandwidth'],
    gaming: ['player', 'quest', 'level', 'boss', 'loot', 'xp', 'skill', 'gear', 'raid', 'dungeon', 'pvp', 'pve', 'grind', 'farm'],
    sciFi: ['android', 'cyborg', 'laser', 'plasma', 'warp', 'teleport', 'hologram', 'drone', 'nanobot', 'exosuit', 'forcefield', 'phaser', 'transporter', 'replicator']
  };
  
  // Hash function
  function getHash(str, seed = 5381) {
    let hash = seed;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  // Generate @username-style path
  function generateAtUsername(hashValue, isAtStyle = true) {
    const categories = Object.keys(wordBanks);
    const numWords = 1 + (hashValue % 2); // 1-2 words for @usernames
    
    let username = isAtStyle ? '@' : '';
    for (let i = 0; i < numWords; i++) {
      const categoryIndex = (hashValue * (i + 1)) % categories.length;
      const category = categories[categoryIndex];
      const words = wordBanks[category];
      const wordIndex = (hashValue * (i + 2)) % words.length;
      const word = words[wordIndex];
      
      // For @usernames, remove hyphens and make camelCase
      if (isAtStyle) {
        username += word.charAt(0).toUpperCase() + word.slice(1);
      } else {
        username += word + (i < numWords - 1 ? '-' : '');
      }
    }
    
    // Add number/suffix for @usernames
    if (isAtStyle) {
      const suffixes = ['', 'X', 'Pro', 'Max', 'HD', 'VR', 'AI', '360', '2024', 'V2', 'Ultra'];
      const suffixIndex = (hashValue * 7) % suffixes.length;
      if (suffixes[suffixIndex]) {
        username += suffixes[suffixIndex];
      }
      
      // Sometimes add numbers
      if (hashValue % 3 === 0) {
        username += (hashValue % 999);
      }
    }
    
    return username;
  }
  
  // Generate full fun URL (with or without @)
  function generateFunUrl(hashValue, pathStr, style = 'mixed') {
    const isAtStyle = style === 'at' || (style === 'mixed' && hashValue % 2 === 0);
    
    if (isAtStyle) {
      return '/' + generateAtUsername(hashValue, true);
    } else {
      const categories = Object.keys(wordBanks);
      const numWords = 2 + (hashValue % 3); // 2-4 words for regular URLs
      
      let url = '/';
      for (let i = 0; i < numWords; i++) {
        const categoryIndex = (hashValue * (i + 1)) % categories.length;
        const category = categories[categoryIndex];
        const words = wordBanks[category];
        const wordIndex = (hashValue * (i + 2)) % words.length;
        url += words[wordIndex] + (i < numWords - 1 ? '-' : '');
      }
      
      const variations = [
        () => url + '-v' + ((hashValue % 99) + 1),
        () => url + ((hashValue % 999) + 1),
        () => url + '-' + hashValue.toString(36).slice(0, 6),
        () => url + '-portal',
        () => url + '-gateway',
        () => url + '-nexus',
        () => url + '-hub',
        () => '/api/' + url.slice(1),
        () => '/v' + ((hashValue % 3) + 1) + url
      ];
      
      return variations[hashValue % variations.length]();
    }
  }
  
  const hash = getHash(path);
  
  // Storage for mappings (in production, use a database)
  let urlMappings = {};
  
  // Load existing mappings or initialize
  try {
    // This would come from a database in production
    urlMappings = {
      // Some initial @username mappings
      '/@Quantum': '/selector.html',
      '/@CosmicX': '/home/index.html',
      '/@DigitalPro': '/docs.html',
      '/@NeoWorkshop': '/editor.html',
      '/@Virtual360': '/explore.html',
      '/@SynthAI': '/config.json',
      '/@StellarDocs': '/Docs/docs.html',
      '/@CyberStudio': '/Editor/editor.html',
      '/@OrbitalVR': '/Explore/explore.html',
      '/@DragonLogin': '/Login/login.html',
      '/@PhoenixAdmin': '/Private/admin.html',
      
      // Regular fun URLs
      '/quantum-portal-v3': '/selector.html',
      '/cosmic-dashboard-42': '/home/index.html',
      '/digital-library-pro': '/docs.html',
      '/neo-workshop-ultra': '/editor.html',
      '/virtual-explorer-hd': '/explore.html'
    };
  } catch (e) {
    urlMappings = {};
  }
  
  // Check if it's a direct file access
  if (allFiles.includes(path)) {
    const funUrl = generateFunUrl(hash, path, 'mixed');
    
    console.log(`🔗 File detected: ${path}`);
    console.log(`   ↳ Generated fun URL: ${funUrl}`);
    
    // Store mapping
    urlMappings[funUrl] = path;
    
    // 301 redirect to fun URL
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Fun-URL', funUrl);
    res.setHeader('X-Original-File', path);
    
    return res.redirect(301, funUrl);
  }
  
  // Check if it's a known fun URL
  if (urlMappings[path]) {
    const targetFile = urlMappings[path];
    
    console.log(`🎉 Fun URL accessed: ${path}`);
    console.log(`   ↳ Serving file: ${targetFile}`);
    
    // Redirect to actual file
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Serving-File', targetFile);
    
    return res.redirect(302, targetFile);
  }
  
  // Check if it's an @username path (even if not in mappings)
  if (path.startsWith('/@')) {
    // Generate a deterministic mapping for this @username
    const targetIndex = hash % allFiles.length;
    const targetFile = allFiles[targetIndex];
    
    // Store this new mapping
    urlMappings[path] = targetFile;
    
    console.log(`✨ New @username: ${path}`);
    console.log(`   ↳ Mapped to: ${targetFile}`);
    
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-New-Mapping', 'true');
    
    return res.redirect(302, targetFile);
  }
  
  // System info endpoint
  if (path === '/url-system-info') {
    const atUrls = Object.keys(urlMappings).filter(k => k.startsWith('/@'));
    const regularUrls = Object.keys(urlMappings).filter(k => !k.startsWith('/@'));
    
    return res.json({
      system: 'Fun URL System',
      status: 'active',
      totalFiles: allFiles.length,
      totalMappings: Object.keys(urlMappings).length,
      atUsernames: atUrls.length,
      regularUrls: regularUrls.length,
      wordBanks: Object.keys(wordBanks).length,
      totalWords: Object.values(wordBanks).reduce((sum, arr) => sum + arr.length, 0),
      sampleAtUrls: atUrls.slice(0, 10),
      sampleRegularUrls: regularUrls.slice(0, 10),
      generateNew: 'Try visiting /@AnyName or /any-fun-url'
    });
  }
  
  // Generate page for testing
  if (path === '/generate-test') {
    const testUrls = [];
    for (let i = 0; i < 20; i++) {
      const testHash = getHash(`test-${i}-${Date.now()}`);
      const style = i % 3 === 0 ? 'at' : (i % 3 === 1 ? 'regular' : 'mixed');
      testUrls.push(generateFunUrl(testHash, `test${i}`, style));
    }
    
    return res.json({
      action: 'test-generation',
      generatedUrls: testUrls,
      note: 'These are sample fun URLs. Visit any to see them in action.'
    });
  }
  
  // For any other path, create a new mapping
  const targetIndex = hash % allFiles.length;
  const targetFile = allFiles[targetIndex];
  
  // Generate what this path's fun URL would be
  const generatedFunUrl = generateFunUrl(hash, path, path.startsWith('/@') ? 'at' : 'regular');
  
  // Store mapping
  urlMappings[path] = targetFile;
  
  console.log(`🚀 New path: ${path}`);
  console.log(`   ↳ Would be: ${generatedFunUrl}`);
  console.log(`   ↳ Serving: ${targetFile}`);
  console.log(`   ↳ Total mappings: ${Object.keys(urlMappings).length}`);
  
  // Redirect to file
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Generated-As', generatedFunUrl);
  
  return res.redirect(302, targetFile);
}
