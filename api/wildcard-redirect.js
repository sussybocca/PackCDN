// api/wildcard-redirect.js
export default function handler(req, res) {
  const fullPath = req.url;
  const path = fullPath.split('?')[0];
  
  console.log(`🌐 Processing: ${path}`);
  
  // ALL your actual files from build output
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
  
  // Enhanced file to fun URL mappings with ALL files
  const fileToFunUrl = {
    // Core navigation
    '/selector.html': 'quantum-portal',
    '/home/index.html': 'cosmic-dashboard',
    '/docs.html': 'digital-library',
    '/editor.html': 'neo-workshop',
    '/explore.html': 'virtual-explorer',
    '/config.json': 'synth-config',
    
    // Docs hierarchy
    '/Docs/docs.html': 'stellar-docs',
    '/Docs/Pages/Home/index.html': 'home-core-nexus',
    '/Docs/Pages/Home/Pages/Editor/editor.html': 'editor-matrix',
    '/Docs/Pages/Home/Pages/Explore/explore.html': 'explore-vortex',
    
    // Editor variations
    '/editor.html': 'cyber-studio',
    '/Editor/editor.html': 'arcane-editor',
    
    // Explore variations
    '/explore.html': 'orbital-discovery',
    '/Explore/explore.html': 'celestial-explorer',
    
    // Auth and admin
    '/Login/login.html': 'dragon-login',
    '/Private/admin.html': 'phoenix-admin',
    
    // Home workspace
    '/home/editor.html': 'home-studio',
    '/home/explore.html': 'home-discovery',
    
    // Additional files from build
    '/config.json': 'crypto-config',
    '/docs.html': 'knowledge-archive',
    '/Explore/explore.html': 'stellar-navigator',
    '/Editor/editor.html': 'digital-forge'
  };
  
  // Build reverse mapping with variations
  const funUrlToFile = {};
  const funUrlVariations = {};
  
  for (const [file, baseFunName] of Object.entries(fileToFunUrl)) {
    // Create multiple variations for each file
    const variations = [
      `/${baseFunName}`,
      `/${baseFunName}-v1`,
      `/${baseFunName}-v2`,
      `/${baseFunName}-v3`,
      `/${baseFunName}-v4`,
      `/${baseFunName}-v5`,
      `/${baseFunName}-pro`,
      `/${baseFunName}-ultra`,
      `/${baseFunName}-max`,
      `/api/${baseFunName}`,
      `/v1/${baseFunName}`,
      `/v2/${baseFunName}`,
      `/v3/${baseFunName}`,
      `/gateway/${baseFunName}`,
      `/portal/${baseFunName}`,
      `/nexus/${baseFunName}`,
      `/core/${baseFunName}`
    ];
    
    variations.forEach(variation => {
      funUrlToFile[variation] = file;
      funUrlVariations[variation] = {
        file: file,
        baseName: baseFunName,
        variation: variation.replace('/', '')
      };
    });
  }
  
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
    digital: ['binary', 'byte', 'pixel', 'render', 'stream', 'buffer', 'cache', 'memory', 'storage', 'server', 'client', 'protocol', 'packet', 'bandwidth']
  };
  
  // Enhanced hash function with more randomness
  function getHash(str, seed = 5381) {
    let hash = seed;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  // Generate fun URL from hash with more creativity
  function generateFunUrlFromHash(hashValue, pathStr) {
    const categories = Object.keys(wordBanks);
    const numWords = 2 + (hashValue % 4); // 2-5 words
    
    let url = '/';
    const usedCategories = new Set();
    
    for (let i = 0; i < numWords; i++) {
      let categoryIndex;
      let attempts = 0;
      
      // Try to use different categories
      do {
        categoryIndex = (hashValue * (i + 1) * (attempts + 1)) % categories.length;
        attempts++;
      } while (usedCategories.has(categoryIndex) && attempts < 10);
      
      usedCategories.add(categoryIndex);
      const category = categories[categoryIndex];
      const words = wordBanks[category];
      const wordIndex = (hashValue * (i + 2) * (attempts + 1)) % words.length;
      const word = words[wordIndex];
      url += word + (i < numWords - 1 ? '-' : '');
    }
    
    // Multiple variation types
    const variationTypes = [
      () => url + '-v' + ((hashValue % 99) + 1),
      () => url + ((hashValue % 999) + 1),
      () => url + '-' + hashValue.toString(36).slice(0, 8),
      () => '/api/' + url.slice(1) + '-api',
      () => '/v' + ((hashValue % 5) + 1) + '/' + url.slice(1),
      () => url + '-portal',
      () => url + '-gateway',
      () => url + '-nexus',
      () => url + '-core',
      () => url + '-matrix',
      () => url + '-hub',
      () => url + '-terminal',
      () => url + '-station',
      () => url + '-outpost',
      () => url + '-forge',
      () => url + '-archive',
      () => url + '-library',
      () => url + '-workshop',
      () => url + '-lab',
      () => url + '-factory'
    ];
    
    const variationIndex = (hashValue * pathStr.length) % variationTypes.length;
    return variationTypes[variationIndex]();
  }
  
  // Check if this is an actual file that should have a fun URL
  if (allFiles.includes(path)) {
    const hash = getHash(path, path.length * 13);
    const funUrl = generateFunUrlFromHash(hash, path);
    
    console.log(`🔗 FILE DETECTED: ${path}`);
    console.log(`   ↳ Generating fun URL: ${funUrl}`);
    
    // Store this mapping
    funUrlToFile[funUrl] = path;
    funUrlVariations[funUrl] = {
      file: path,
      baseName: path.split('/').pop().replace('.html', '').replace('.json', ''),
      variation: 'auto-generated',
      generatedAt: new Date().toISOString()
    };
    
    // 301 PERMANENT redirect to fun URL
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Fun-URL-System', 'enabled');
    res.setHeader('X-Original-File', path);
    res.setHeader('X-Generated-Fun-URL', funUrl);
    res.setHeader('X-File-Hash', hash.toString());
    res.setHeader('X-Total-Mappings', Object.keys(funUrlToFile).length.toString());
    
    return res.redirect(301, funUrl);
  }
  
  // Check if this is a known fun URL
  if (funUrlToFile[path]) {
    const targetFile = funUrlToFile[path];
    const variationInfo = funUrlVariations[path] || {};
    
    console.log(`🎉 FUN URL ACCESS: ${path}`);
    console.log(`   ↳ Mapping to file: ${targetFile}`);
    console.log(`   ↳ Variation info:`, variationInfo);
    
    // Serve the actual file
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Fun-URL-System', 'serving');
    res.setHeader('X-Target-File', targetFile);
    res.setHeader('X-Fun-URL', path);
    res.setHeader('X-Variation-Type', variationInfo.variation || 'standard');
    
    return res.redirect(302, targetFile);
  }
  
  // Handle API info requests
  if (path === '/fun-url-system-info' || path.includes('/show-system')) {
    const totalMappings = Object.keys(funUrlToFile).length;
    const sampleMappings = Object.entries(funUrlToFile).slice(0, 20).map(([funUrl, file]) => ({
      funUrl,
      file,
      example: `https://pack-cdn.vercel.app${funUrl}`
    }));
    
    return res.json({
      system: 'Advanced Fun URL Generation System',
      status: 'active',
      timestamp: new Date().toISOString(),
      totalFiles: allFiles.length,
      totalFunUrlMappings: totalMappings,
      wordCategories: Object.keys(wordBanks).length,
      totalWords: Object.values(wordBanks).reduce((sum, arr) => sum + arr.length, 0),
      possibleCombinations: 'Millions (generated on-demand)',
      sampleMappings: sampleMappings,
      endpoints: {
        systemInfo: '/fun-url-system-info',
        generateTest: '/generate-test-url',
        allFiles: '/list-all-files'
      }
    });
  }
  
  // Generate a NEW fun URL for any unknown path
  const hash = getHash(path, path.length * 17);
  const generatedFunUrl = generateFunUrlFromHash(hash, path);
  
  // Pick a file to map this to
  const fileIndex = hash % allFiles.length;
  const mappedFile = allFiles[fileIndex];
  
  // Store the new mapping
  funUrlToFile[generatedFunUrl] = mappedFile;
  funUrlVariations[generatedFunUrl] = {
    file: mappedFile,
    baseName: 'auto-generated',
    variation: 'dynamic',
    generatedAt: new Date().toISOString(),
    originalPath: path
  };
  
  console.log(`✨ DYNAMIC GENERATION: ${path}`);
  console.log(`   ↳ Generated fun URL: ${generatedFunUrl}`);
  console.log(`   ↳ Mapped to file: ${mappedFile}`);
  console.log(`   ↳ Total mappings now: ${Object.keys(funUrlToFile).length}`);
  
  // If it's a test request, show info
  if (path.includes('/test') || path.includes('/generate')) {
    return res.json({
      action: 'dynamic-fun-url-generation',
      originalPath: path,
      generatedFunUrl: generatedFunUrl,
      mappedToFile: mappedFile,
      hash: hash,
      totalMappings: Object.keys(funUrlToFile).length,
      tryUrl: `https://pack-cdn.vercel.app${generatedFunUrl}`,
      systemInfo: 'Visit /fun-url-system-info for complete system details'
    });
  }
  
  // Redirect to the actual file
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Fun-URL-System', 'dynamic-generation');
  res.setHeader('X-Generated-Fun-URL', generatedFunUrl);
  res.setHeader('X-Mapped-To-File', mappedFile);
  res.setHeader('X-Original-Path', path);
  res.setHeader('X-Generation-Hash', hash.toString());
  
  return res.redirect(302, mappedFile);
}
