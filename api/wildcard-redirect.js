// api/wildcard-redirect.js
export default function handler(req, res) {
  const fullPath = req.url;
  const path = fullPath.split('?')[0];
  
  console.log(`🔗 Processing: ${path}`);
  
  // All your pages
  const allPages = [
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
  
  // MASSIVE 100+ WORD BANKS FOR ENCRYPTED CODES
  const wordBanks = {
    // 100+ tech words
    tech: [
      'quantum', 'cyber', 'digital', 'virtual', 'neural', 'synth', 'crypto', 'blockchain', 
      'ai', 'machine', 'learning', 'bot', 'data', 'cloud', 'server', 'client', 'network',
      'protocol', 'binary', 'byte', 'pixel', 'render', 'stream', 'buffer', 'cache',
      'memory', 'storage', 'database', 'api', 'sdk', 'framework', 'library', 'module',
      'interface', 'terminal', 'console', 'shell', 'kernel', 'driver', 'firmware', 'hardware',
      'software', 'application', 'website', 'webapp', 'mobile', 'desktop', 'laptop', 'tablet',
      'phone', 'router', 'switch', 'firewall', 'encrypt', 'decrypt', 'hash', 'encode', 'decode',
      'compress', 'decompress', 'upload', 'download', 'sync', 'backup', 'restore', 'migrate',
      'deploy', 'host', 'domain', 'subdomain', 'dns', 'ip', 'tcp', 'udp', 'http', 'https',
      'ssl', 'tls', 'ssh', 'ftp', 'smtp', 'imap', 'pop3', 'json', 'xml', 'html', 'css', 'js',
      'python', 'java', 'cpp', 'csharp', 'go', 'rust', 'ruby', 'php', 'sql', 'nosql', 'redis',
      'mongodb', 'mysql', 'postgres', 'graphql', 'rest', 'soap', 'websocket', 'grpc'
    ],
    
    // 100+ space/science words
    space: [
      'cosmic', 'stellar', 'galactic', 'orbital', 'lunar', 'solar', 'nebula', 'pulsar', 
      'quasar', 'wormhole', 'blackhole', 'singularity', 'eventhorizon', 'supernova', 
      'constellation', 'galaxy', 'universe', 'multiverse', 'dimension', 'reality', 
      'planet', 'star', 'moon', 'sun', 'comet', 'asteroid', 'meteor', 'meteorite',
      'gravity', 'relativity', 'quantum', 'particle', 'atom', 'molecule', 'proton',
      'neutron', 'electron', 'photon', 'neutrino', 'boson', 'fermion', 'quark', 'lepton',
      'hadron', 'meson', 'baryon', 'gluon', 'higgs', 'darkmatter', 'darkenergy', 'antimatter',
      'entropy', 'thermodynamics', 'kinetic', 'potential', 'velocity', 'acceleration',
      'momentum', 'inertia', 'friction', 'resistance', 'conductivity', 'superconductivity',
      'semiconductor', 'insulator', 'conductor', 'magnet', 'magnetic', 'electric', 'voltage',
      'current', 'resistance', 'capacitance', 'inductance', 'transistor', 'diode', 'led',
      'laser', 'photonics', 'optics', 'refraction', 'reflection', 'diffraction', 'interference',
      'wavelength', 'frequency', 'amplitude', 'hertz', 'decibel', 'lumen', 'candela', 'lux'
    ],
    
    // 100+ fantasy/magic words
    fantasy: [
      'dragon', 'phoenix', 'wizard', 'mage', 'sorcerer', 'warlock', 'witch', 'arcane',
      'mythic', 'legend', 'rune', 'spell', 'enchanted', 'magic', 'magical', 'knight',
      'castle', 'realm', 'kingdom', 'empire', 'dungeon', 'labyrinth', 'maze', 'crypt',
      'tomb', 'temple', 'shrine', 'altar', 'ritual', 'ceremony', 'incantation', 'chant',
      'potion', 'elixir', 'potion', 'brew', 'alchemy', 'alchemist', 'scroll', 'tome',
      'grimoire', 'codex', 'manuscript', 'artifact', 'relic', 'amulet', 'talisman',
      'trinket', 'orb', 'crystal', 'gem', 'jewel', 'diamond', 'ruby', 'emerald', 'sapphire',
      'amethyst', 'topaz', 'opal', 'pearl', 'obsidian', 'quartz', 'crystal', 'mineral',
      'ore', 'metal', 'gold', 'silver', 'platinum', 'copper', 'iron', 'steel', 'bronze',
      'brass', 'titanium', 'tungsten', 'uranium', 'plutonium', 'mercury', 'lead', 'tin',
      'zinc', 'nickel', 'cobalt', 'chromium', 'manganese', 'silicon', 'germanium', 'arsenic'
    ],
    
    // 100+ nature/earth words
    nature: [
      'forest', 'jungle', 'rainforest', 'woodland', 'grove', 'thicket', 'copse', 'orchard',
      'vineyard', 'farm', 'field', 'meadow', 'pasture', 'prairie', 'savanna', 'steppe',
      'tundra', 'taiga', 'desert', 'dunes', 'oasis', 'ocean', 'sea', 'lake', 'river',
      'stream', 'creek', 'brook', 'rivulet', 'waterfall', 'cascade', 'rapids', 'whirlpool',
      'estuary', 'delta', 'bay', 'gulf', 'cove', 'inlet', 'fjord', 'archipelago', 'island',
      'peninsula', 'isthmus', 'cape', 'headland', 'cliff', 'bluff', 'canyon', 'gorge',
      'ravine', 'valley', 'dale', 'glen', 'basin', 'depression', 'crater', 'caldera',
      'volcano', 'geyser', 'hotspring', 'fumarole', 'solfatara', 'mudpot', 'lava', 'magma',
      'igneous', 'sedimentary', 'metamorphic', 'rock', 'stone', 'boulder', 'pebble', 'gravel',
      'sand', 'silt', 'clay', 'loam', 'humus', 'soil', 'dirt', 'earth', 'mud', 'sludge'
    ]
  };
  
  // Combine all words into one massive array (400+ words)
  const allWords = [
    ...wordBanks.tech,
    ...wordBanks.space,
    ...wordBanks.fantasy,
    ...wordBanks.nature
  ];
  
  // Hash function for deterministic generation
  function getHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  // Generate encrypted 10-digit code using word banks
  function generateEncryptedCode(input) {
    const hash = getHash(input);
    
    // Format: @word1-word2-number
    const word1 = allWords[(hash * 1) % allWords.length];
    const word2 = allWords[(hash * 3) % allWords.length];
    const number = (hash % 9999).toString().padStart(4, '0');
    
    // Create variations
    const formats = [
      `@${word1}-${word2}-${number}`,
      `@${word1.slice(0, 3)}-${word2.slice(0, 3)}-${number}`,
      `@${word1}-${number}-${word2}`,
      `@${word1.slice(0, 4)}${word2.slice(0, 3)}${number.slice(0, 3)}`,
      `@${word1}${word2.slice(0, 2)}${number}`
    ];
    
    return formats[hash % formats.length].toLowerCase();
  }
  
  // Generate fun @username from input
  function generateFunUsername(input) {
    const code = generateEncryptedCode(input + Date.now() + Math.random());
    return `/${code}`; // Returns like /@quantum-dragon-0420
  }
  
  // In-memory storage for mappings
  const urlMappings = new Map();
  
  // Initialize with some sample mappings using word banks
  for (let i = 0; i < Math.min(20, allPages.length); i++) {
    const funUrl = generateFunUsername(`init${i}${allPages[i]}`);
    urlMappings.set(funUrl, allPages[i]);
  }
  
  // Check if it's a file path that should get a fun URL
  if (allPages.includes(path)) {
    // Generate encrypted code for this file
    const funUrl = generateFunUsername(path + Date.now());
    
    // Store mapping
    urlMappings.set(funUrl, path);
    
    console.log(`📄 File: ${path} → ${funUrl}`);
    
    // 301 Permanent redirect to encrypted URL
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Encrypted-URL', funUrl);
    res.setHeader('X-Original-File', path);
    
    return res.redirect(301, funUrl);
  }
  
  // Handle @ paths - ANY @anything gets mapped
  if (path.startsWith('/@')) {
    // Check if we already have this mapping
    if (urlMappings.has(path)) {
      const targetFile = urlMappings.get(path);
      console.log(`🔑 Known @path: ${path} → ${targetFile}`);
      
      // Serve the file
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Target-File', targetFile);
      
      return res.redirect(302, targetFile);
    }
    
    // NEW @path - map to random page
    const randomIndex = Math.floor(Math.random() * allPages.length);
    const targetFile = allPages[randomIndex];
    
    // Store the mapping
    urlMappings.set(path, targetFile);
    
    console.log(`✨ NEW @path: ${path} → ${targetFile}`);
    
    // Serve the file
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-New-Mapping', 'true');
    res.setHeader('X-Target-File', targetFile);
    
    return res.redirect(302, targetFile);
  }
  
  // Show system info
  if (path === '/url-system' || path === '/info') {
    const totalWords = allWords.length;
    const totalMappings = urlMappings.size;
    
    // Generate sample codes
    const samples = [];
    for (let i = 0; i < 15; i++) {
      samples.push(generateFunUsername(`sample${i}`));
    }
    
    return res.json({
      system: 'Encrypted URL System',
      status: 'active',
      totalPages: allPages.length,
      totalWords: totalWords,
      totalMappings: totalMappings,
      wordCategories: Object.keys(wordBanks).length,
      sampleUrls: samples.slice(0, 10),
      allPages: allPages,
      usage: 'Any /@anything maps to a random page. File paths get encrypted URLs.'
    });
  }
  
  // Generate test batch
  if (path === '/generate-batch') {
    const batch = [];
    for (let i = 0; i < 50; i++) {
      const code = generateFunUsername(`batch${i}${Date.now()}`);
      const page = allPages[i % allPages.length];
      batch.push({
        encryptedUrl: code,
        mapsTo: page,
        fullUrl: `https://pack-cdn.vercel.app${code}`
      });
    }
    
    return res.json({
      action: 'batch-generation',
      count: batch.length,
      generated: batch,
      note: '50 encrypted URLs generated'
    });
  }
  
  // For any other path, generate new encrypted URL
  const funUrl = generateFunUsername(path + Date.now());
  const randomIndex = Math.floor(Math.random() * allPages.length);
  const targetFile = allPages[randomIndex];
  
  // Store mapping
  urlMappings.set(funUrl, targetFile);
  
  console.log(`🚀 Random path: ${path} → ${funUrl} → ${targetFile}`);
  
  // Redirect to the encrypted URL
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Generated-URL', funUrl);
  res.setHeader('X-Target-File', targetFile);
  
  return res.redirect(302, funUrl);
}
