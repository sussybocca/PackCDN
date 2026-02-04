// /api/wildcard-redirect.js
export default function handler(req, res) {
  const fullPath = req.url;
  const path = fullPath.split('?')[0];
  const queryParams = new URLSearchParams(fullPath.split('?')[1] || '');
  
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
    '/selector.html',
    '/embed.html',
    '/dev-panel.html'
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
  
  // --- SPECIAL HANDLERS ---
  
  // Handle @random - Developer Panel
  if (path === '/@random') {
    console.log(`🎨 Dev Panel: ${path} → /dev-panel.html`);
    return res.redirect(302, '/dev-panel.html');
  }
  
  // Handle @embed/ - Embedded websites
  if (path.startsWith('/@embed/')) {
    const embedUrl = decodeURIComponent(path.substring(8));
    console.log(`🌐 Embed Request: ${path} → /embed.html?url=${embedUrl}`);
    return res.redirect(302, `/embed.html?url=${encodeURIComponent(embedUrl)}`);
  }
  
  // Handle user-created pages (@username from localStorage)
  if (path.startsWith('/@') && path !== '/@random' && !path.startsWith('/@embed/')) {
    const username = path.substring(2).split('?')[0].split('/')[0];
    
    // Check if this is a reserved word
    const reserved = ['quantum', 'cosmic', 'digital', 'neo', 'virtual', 'synth', 'stellar', 
                     'cyber', 'orbital', 'dragon', 'phoenix', 'homecore', 'editornetwork',
                     'explorervortex', 'homestudio', 'homediscovery'];
    
    if (reserved.includes(username)) {
      // Let it fall through to normal processing
    } else {
      // Try to load from localStorage via API
      try {
        // In a real serverless function, we'd need to simulate localStorage
        // For now, we'll check if there's a page in a simulated storage
        const pageData = getPageFromStorage(username);
        
        if (pageData) {
          console.log(`📝 User Page: @${username} → Rendering custom page`);
          
          if (pageData.type === 'embed') {
            // Redirect to embed page
            return res.redirect(302, `/embed.html?url=${encodeURIComponent(pageData.content)}`);
          } else {
            // Render HTML page
            return res.send(renderUserPage(username, pageData));
          }
        }
      } catch (error) {
        console.log(`❌ Error loading user page @${username}:`, error.message);
        // Fall through to normal processing
      }
    }
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
  
  // Handle direct requests to embed.html with query params
  if (path === '/embed.html' && queryParams.has('url')) {
    const embedUrl = queryParams.get('url');
    console.log(`🌐 Direct Embed: ${path}?url=${embedUrl}`);
    
    // Return the embed page directly
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv="refresh" content="0;url=/@embed/${encodeURIComponent(embedUrl)}">
        </head>
        <body>
          <p>Redirecting to embedded page...</p>
          <script>
            window.location.href = "/@embed/${encodeURIComponent(embedUrl)}";
          </script>
        </body>
      </html>
    `);
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
      system: 'Encrypted URL System v2.0',
      status: 'active',
      features: ['@random dev panel', '@embed website embedding', '@username custom pages'],
      totalPages: allPages.length,
      totalWords: totalWords,
      totalMappings: totalMappings,
      wordCategories: Object.keys(wordBanks).length,
      sampleUrls: samples.slice(0, 10),
      allPages: allPages,
      specialPaths: {
        '/@random': 'Developer Panel (create custom pages)',
        '/@embed/*': 'Embed external websites',
        '/@username': 'User-created custom pages'
      },
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

// Helper functions for user page storage (simulated in serverless context)
function getPageFromStorage(username) {
  // In a real implementation, this would access a database
  // For now, we'll simulate with in-memory storage
  
  // Create some demo pages for testing
  const demoPages = {
    'demo': {
      name: 'demo',
      title: 'Demo Page',
      type: 'html',
      content: '<h1>Welcome to Demo Page!</h1><p>This is a user-created page via @random</p>',
      created: new Date().toISOString()
    },
    'test': {
      name: 'test',
      title: 'Test Page',
      type: 'embed',
      content: 'https://example.com',
      created: new Date().toISOString()
    }
  };
  
  return demoPages[username] || null;
}

function renderUserPage(username, pageData) {
  const escapedContent = pageData.content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  return `
<!DOCTYPE html>
<html>
  <head>
    <title>${pageData.title} | @${username} | Pack CDN</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
      }
      .container { 
        max-width: 1000px; 
        margin: 0 auto; 
        padding: 20px;
      }
      .page-header {
        background: rgba(255, 255, 255, 0.95);
        border-radius: 15px;
        padding: 30px;
        margin-bottom: 20px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        text-align: center;
      }
      .page-content {
        background: white;
        border-radius: 15px;
        padding: 40px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.1);
        min-height: 500px;
      }
      .back-link {
        display: inline-block;
        margin-bottom: 20px;
        color: #667eea;
        text-decoration: none;
        font-weight: 500;
      }
      .user-badge {
        display: inline-block;
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        color: white;
        padding: 5px 15px;
        border-radius: 20px;
        font-size: 0.9rem;
        margin-left: 10px;
      }
      .nav-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
      }
      .nav-links a {
        margin-left: 15px;
        color: white;
        text-decoration: none;
      }
      .page-footer {
        text-align: center;
        margin-top: 30px;
        color: white;
        opacity: 0.8;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="nav-bar">
        <a href="/" class="back-link">🏠 Home</a>
        <div class="nav-links">
          <a href="/@random">Create Page</a>
          <a href="/@digital">Docs</a>
          <a href="/@neo">Editor</a>
        </div>
      </div>
      
      <div class="page-header">
        <h1>${pageData.title}</h1>
        <p>Created by <span class="user-badge">@${username}</span></p>
      </div>
      
      <div class="page-content" id="content">
        ${pageData.type === 'embed' 
          ? `<iframe src="${pageData.content}" style="width:100%; height:100%; border:none; border-radius:10px;"></iframe>`
          : pageData.content
        }
      </div>
      
      <div class="page-footer">
        <p>Page served via Pack CDN • <a href="/@random" style="color:white;">Create your own page</a></p>
      </div>
    </div>
    
    <script>
      // Execute any JavaScript in the content (for HTML pages)
      if ('${pageData.type}' === 'html') {
        const contentDiv = document.getElementById('content');
        const scripts = contentDiv.getElementsByTagName('script');
        for (let script of scripts) {
          const newScript = document.createElement('script');
          newScript.textContent = script.textContent;
          document.head.appendChild(newScript);
        }
      }
      
      // Add edit button for page creator (simulated)
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('edit') === 'true') {
        const editBtn = document.createElement('button');
        editBtn.textContent = '✏️ Edit Page';
        editBtn.style = 'position:fixed; bottom:20px; right:20px; padding:10px 20px; background:#667eea; color:white; border:none; border-radius:8px; cursor:pointer;';
        editBtn.onclick = () => {
          localStorage.setItem('editPageData', JSON.stringify(${JSON.stringify(pageData)}));
          window.location.href = '/@random';
        };
        document.body.appendChild(editBtn);
      }
    </script>
  </body>
</html>
  `;
}
