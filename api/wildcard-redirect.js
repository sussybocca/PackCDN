// /api/wildcard-redirect.js - COMPLETE UPDATED VERSION WITH SUPABASE
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req, res) {
  const fullPath = req.url;
  const path = fullPath.split('?')[0];
  const queryParams = new URLSearchParams(fullPath.split('?')[1] || '');
  
  console.log(`🔗 Processing: ${path}`);
  
  // All your original pages
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
  
  // Reserved @names for system pages (NO SLASH)
  const reservedNames = [
    'quantum', 'cosmic', 'digital', 'neo', 'virtual', 'synth', 'stellar', 
    'cyber', 'orbital', 'dragon', 'phoenix', 'homecore', 'editornetwork',
    'explorervortex', 'homestudio', 'homediscovery', 'random', 'embed'
  ];
  
  // --- NEW LOGIC: Handle @username without slash ---
  
  // Extract @username from path (handle both /@username and @username)
  let username = null;
  if (path.startsWith('/@')) {
    username = path.substring(2).split('?')[0].split('/')[0];
  } else if (path.startsWith('@') && path.length > 1) {
    username = path.substring(1).split('?')[0].split('/')[0];
  }
  
  // Handle @username (user pages from Supabase)
  if (username && !reservedNames.includes(username)) {
    try {
      // Fetch page from Supabase
      const { data: page, error } = await supabase
        .from('User_Pages')
        .select('*')
        .eq('page_id', username)
        .eq('is_public', true)
        .single();
      
      if (error) {
        console.log(`❌ Supabase error for @${username}:`, error.message);
      }
      
      if (page) {
        console.log(`📝 User Page Found: @${username}`);
        
        // Increment view count
        await supabase
          .from('User_Pages')
          .update({ views: page.views + 1 })
          .eq('id', page.id);
        
        // Render the page
        return res.send(renderUserPage(username, page));
      }
    } catch (error) {
      console.log(`❌ Error loading user page @${username}:`, error.message);
    }
  }
  
  // --- ORIGINAL LOGIC (for backward compatibility) ---
  
  // MASSIVE 100+ WORD BANKS FOR ENCRYPTED CODES - COMPLETE VERSION
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
      'potion', 'elixir', 'brew', 'alchemy', 'alchemist', 'scroll', 'tome',
      'grimoire', 'codex', 'manuscript', 'artifact', 'relic', 'amulet', 'talisman',
      'trinket', 'orb', 'crystal', 'gem', 'jewel', 'diamond', 'ruby', 'emerald', 'sapphire',
      'amethyst', 'topaz', 'opal', 'pearl', 'obsidian', 'quartz', 'mineral',
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
  
  // Generate encrypted code using word banks
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
  
  // --- SPECIAL HANDLERS (UPDATED) ---
  
  // Handle @random - Developer Panel
  if (username === 'random') {
    console.log(`🎨 Dev Panel: ${path} → /dev-panel.html`);
    return res.redirect(302, '/dev-panel.html');
  }
  
  // Handle @embed - Embedded websites
  if (username === 'embed' && path.includes('/')) {
    const embedPath = path.split('@embed/')[1] || path.split('embed/')[1];
    if (embedPath) {
      const embedUrl = decodeURIComponent(embedPath);
      console.log(`🌐 Embed Request: ${path} → /embed.html?url=${embedUrl}`);
      return res.redirect(302, `/embed.html?url=${encodeURIComponent(embedUrl)}`);
    }
  }
  
  // Handle reserved names (redirect to /@name for consistency)
  if (username && reservedNames.includes(username) && !path.startsWith('/@')) {
    return res.redirect(301, `/@${username}${path.substring(username.length + 1)}`);
  }
  
  // Handle /@ paths (backward compatibility)
  if (path.startsWith('/@')) {
    const pathUsername = path.substring(2).split('?')[0].split('/')[0];
    
    // If it's a reserved name, redirect without slash?
    if (reservedNames.includes(pathUsername)) {
      // Keep as is for system pages
    } else {
      // Check Supabase for user page
      try {
        const { data: page } = await supabase
          .from('User_Pages')
          .select('*')
          .eq('page_id', pathUsername)
          .eq('is_public', true)
          .single();
        
        if (page) {
          // Redirect to @username format (no slash)
          return res.redirect(301, `@${pathUsername}`);
        }
      } catch (error) {
        // Continue with original logic
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
    // Get stats from Supabase
    let pageCount = 0;
    let topPages = [];
    
    try {
      const { count } = await supabase
        .from('User_Pages')
        .select('*', { count: 'exact', head: true });
      pageCount = count || 0;
      
      const { data } = await supabase
        .from('User_Pages')
        .select('page_id, title, views, created_at')
        .eq('is_public', true)
        .order('views', { ascending: false })
        .limit(10);
      topPages = data || [];
    } catch (error) {
      console.log('Supabase stats error:', error.message);
    }
    
    // Generate sample codes
    const samples = [];
    for (let i = 0; i < 15; i++) {
      samples.push(generateFunUsername(`sample${i}`));
    }
    
    return res.json({
      system: 'Pack CDN URL System v3.0',
      status: 'active',
      features: [
        '@username - User pages (Supabase)',
        '@random - Developer Panel',
        '@embed/* - Embedded websites',
        'Encrypted URLs'
      ],
      stats: {
        userPages: pageCount,
        systemPages: allPages.length,
        topPages: topPages,
        totalWords: allWords.length,
        totalMappings: urlMappings.size
      },
      sampleUrls: samples.slice(0, 10),
      usage: [
        'https://pack-cdn.vercel.app@username - Access user page',
        'https://pack-cdn.vercel.app/@username - Alternative access',
        'https://pack-cdn.vercel.app@random - Create pages',
        'https://pack-cdn.vercel.app@embed/url - Embed websites'
      ]
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

// Enhanced renderUserPage with Supabase data - COMPLETE FUNCTION
function renderUserPage(username, pageData) {
  const safeContent = pageData.content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  const tags = pageData.tags || [];
  const views = pageData.views || 0;
  const likes = pageData.likes || 0;
  const created = new Date(pageData.created_at).toLocaleDateString();
  
  let contentHtml = '';
  if (pageData.page_type === 'embed') {
    contentHtml = `
      <div style="width: 100%; height: 600px; border-radius: 15px; overflow: hidden;">
        <iframe 
          src="${pageData.content}" 
          style="width:100%; height:100%; border:none;"
          allow="camera; microphone; geolocation"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
          title="${pageData.title}"
        ></iframe>
      </div>
      <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 10px;">
        <strong>Embedded URL:</strong> <a href="${pageData.content}" target="_blank">${pageData.content}</a>
      </div>
    `;
  } else {
    contentHtml = pageData.content;
  }
  
  return `
<!DOCTYPE html>
<html>
  <head>
    <title>${pageData.title} | @${username} | Pack CDN</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta property="og:title" content="${pageData.title}">
    <meta property="og:description" content="User-created page on Pack CDN">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://pack-cdn.vercel.app@${username}">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        color: #333;
      }
      .container { 
        max-width: 1200px; 
        margin: 0 auto; 
        padding: 20px;
      }
      .page-header {
        background: rgba(255, 255, 255, 0.98);
        border-radius: 20px;
        padding: 40px;
        margin-bottom: 30px;
        box-shadow: 0 15px 50px rgba(0,0,0,0.1);
        text-align: center;
        backdrop-filter: blur(10px);
      }
      .page-content {
        background: white;
        border-radius: 20px;
        padding: 40px;
        box-shadow: 0 25px 70px rgba(0,0,0,0.1);
        min-height: 500px;
        margin-bottom: 30px;
      }
      .user-badge {
        display: inline-block;
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        color: white;
        padding: 10px 25px;
        border-radius: 30px;
        font-weight: 700;
        font-size: 1.1rem;
        margin: 20px 0;
        text-decoration: none;
        transition: transform 0.3s;
      }
      .user-badge:hover {
        transform: scale(1.05);
      }
      .page-stats {
        display: flex;
        gap: 30px;
        justify-content: center;
        margin-top: 25px;
        color: #666;
        font-size: 0.95rem;
        flex-wrap: wrap;
      }
      .stat-item {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #f8f9fa;
        padding: 10px 20px;
        border-radius: 10px;
      }
      .action-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
        flex-wrap: wrap;
        gap: 15px;
      }
      .btn {
        padding: 12px 30px;
        background: white;
        border: 2px solid #667eea;
        color: #667eea;
        border-radius: 12px;
        text-decoration: none;
        font-weight: 600;
        transition: all 0.3s;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .btn:hover {
        background: #667eea;
        color: white;
        transform: translateY(-2px);
        box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
      }
      .btn-create {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        color: white;
        border: none;
      }
      .tags {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 25px;
        justify-content: center;
      }
      .tag {
        background: #e9ecef;
        padding: 8px 18px;
        border-radius: 20px;
        font-size: 0.9rem;
        color: #495057;
        transition: all 0.3s;
      }
      .tag:hover {
        background: #667eea;
        color: white;
        transform: translateY(-2px);
      }
      .page-footer {
        text-align: center;
        margin-top: 40px;
        padding: 25px;
        background: rgba(255, 255, 255, 0.9);
        border-radius: 15px;
        color: #666;
      }
      .page-footer a {
        color: #667eea;
        text-decoration: none;
        font-weight: 600;
      }
      h1 {
        font-size: 2.8rem;
        margin-bottom: 10px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      @media (max-width: 768px) {
        .container {
          padding: 15px;
        }
        .page-header, .page-content {
          padding: 25px;
        }
        h1 {
          font-size: 2rem;
        }
        .action-bar {
          flex-direction: column;
          align-items: stretch;
        }
        .btn {
          width: 100%;
          justify-content: center;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="action-bar">
        <a href="/" class="btn">🏠 Home</a>
        <a href="@random" class="btn btn-create">✨ Create Your Page</a>
        <a href="/api/Pages/Explore/explore-pages" class="btn">🔍 Explore Pages</a>
      </div>
      
      <div class="page-header">
        <h1>${pageData.title}</h1>
        <a href="@${username}" class="user-badge">@${username}</a>
        
        ${tags.length > 0 ? `
          <div class="tags">
            ${tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
          </div>
        ` : ''}
        
        <div class="page-stats">
          <div class="stat-item">👁️ ${views} views</div>
          <div class="stat-item">❤️ ${likes} likes</div>
          <div class="stat-item">📅 Created ${created}</div>
          <div class="stat-item">🔄 Version ${pageData.version || 1}</div>
        </div>
      </div>
      
      <div class="page-content" id="content">
        ${contentHtml}
      </div>
      
      <div class="page-footer">
        <p>✨ This page was created with <strong>Pack CDN</strong> • 
           <a href="@random">Create your own page</a> • 
           <a href="/api/Pages/Explore/explore-pages">Explore more pages</a>
        </p>
        <p style="margin-top: 10px; font-size: 0.9rem; opacity: 0.7;">
          Page ID: ${pageData.page_id} • Last updated: ${new Date(pageData.updated_at).toLocaleDateString()}
        </p>
      </div>
    </div>
    
    <script>
      // Execute any JavaScript in the content (for HTML pages)
      if ('${pageData.page_type}' === 'html' || '${pageData.page_type}' === 'dashboard') {
        const contentDiv = document.getElementById('content');
        const scripts = contentDiv.getElementsByTagName('script');
        for (let script of scripts) {
          const newScript = document.createElement('script');
          newScript.textContent = script.textContent;
          document.head.appendChild(newScript);
        }
        
        // Also handle inline event handlers
        const elementsWithInlineEvents = contentDiv.querySelectorAll('[onclick], [onload], [onmouseover]');
        elementsWithInlineEvents.forEach(el => {
          const attrs = el.attributes;
          for (let attr of attrs) {
            if (attr.name.startsWith('on')) {
              el[attr.name] = new Function(attr.value);
            }
          }
        });
      }
      
      // Add like functionality
      const likeBtn = document.createElement('button');
      likeBtn.innerHTML = '❤️ Like';
      likeBtn.style.cssText = \`
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 24px;
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        color: white;
        border: none;
        border-radius: 25px;
        cursor: pointer;
        font-weight: 600;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 1000;
      \`;
      
      likeBtn.onclick = async () => {
        try {
          const response = await fetch('/api/user-pages/like', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ page_id: '${username}' })
          });
          
          if (response.ok) {
            likeBtn.innerHTML = '❤️ Liked!';
            likeBtn.style.background = '#4CAF50';
            likeBtn.disabled = true;
            
            // Update likes count
            const likesElement = document.querySelector('.stat-item:nth-child(2)');
            if (likesElement) {
              const currentLikes = parseInt(likesElement.textContent.match(/\\d+/)[0]);
              likesElement.innerHTML = \`❤️ \${currentLikes + 1} likes\`;
            }
          }
        } catch (error) {
          console.error('Like error:', error);
        }
      };
      
      document.body.appendChild(likeBtn);
      
      // Analytics
      window.addEventListener('load', () => {
        // Send view event (already handled server-side)
        console.log('Page @${username} loaded successfully');
      });
    </script>
  </body>
</html>
  `;
}
