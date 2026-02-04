// /api/wildcard-redirect.js - FIXED & ENHANCED VERSION
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
  
  // --- FIX: Handle @random correctly ---
  // Extract @username from path
  let username = null;
  if (path.startsWith('/@')) {
    username = path.substring(2).split('?')[0].split('/')[0];
  } else if (path.startsWith('@') && path.length > 1) {
    // Handle direct @username (no slash)
    username = path.substring(1).split('?')[0].split('/')[0];
  }
  
  // SPECIAL CASE: @random should go directly to dev-panel
  if (username === 'random') {
    console.log(`🎨 Dev Panel: ${path} → /dev-panel.html`);
    return res.redirect(302, '/dev-panel.html');
  }
  
  // Handle @embed - Embedded websites
  if (username === 'embed' && path.includes('/')) {
    const embedPath = path.includes('@embed/') 
      ? path.split('@embed/')[1] 
      : path.split('embed/')[1];
    if (embedPath) {
      const embedUrl = decodeURIComponent(embedPath);
      console.log(`🌐 Embed Request: ${path} → /embed.html?url=${embedUrl}`);
      return res.redirect(302, `/embed.html?url=${encodeURIComponent(embedUrl)}`);
    }
  }
  
  // --- Handle user pages from Supabase ---
  if (username && !reservedNames.includes(username)) {
    try {
      // Fetch page from Supabase
      const { data: page, error } = await supabase
        .from('user_pages')
        .select('*')
        .eq('page_id', username)
        .eq('is_public', true)
        .maybeSingle();
      
      if (error) {
        console.log(`❌ Supabase query error for @${username}:`, error.message);
        // Fall through
      } else if (page) {
        console.log(`📝 User Page Found: @${username} - "${page.title}" (Type: ${page.page_type})`);
        
        // Increment view count
        supabase
          .from('user_pages')
          .update({ views: (page.views || 0) + 1 })
          .eq('id', page.id)
          .then(() => console.log(`📈 View count updated for @${username}`))
          .catch(e => console.log(`⚠️ View count update failed:`, e.message));
        
        // Render the page based on type
        return res.send(renderUserPage(username, page));
      } else {
        console.log(`📭 No page found for @${username}, falling back to original logic`);
        // Continue to original logic
      }
    } catch (error) {
      console.log(`❌ Error loading user page @${username}:`, error.message);
      // Fall through
    }
  }
  
  // --- ORIGINAL LOGIC (for backward compatibility) ---
  
  // MASSIVE 100+ WORD BANKS FOR ENCRYPTED CODES
  const wordBanks = {
    tech: [
      'quantum', 'cyber', 'digital', 'virtual', 'neural', 'synth', 'crypto', 'blockchain', 
      'ai', 'machine', 'learning', 'bot', 'data', 'cloud', 'server', 'client', 'network',
      'protocol', 'binary', 'byte', 'pixel', 'render', 'stream', 'buffer', 'cache',
      'memory', 'storage', 'database', 'api', 'sdk', 'framework', 'library', 'module',
      'interface', 'terminal', 'console', 'shell', 'kernel', 'driver', 'firmware', 'hardware'
    ],
    space: [
      'cosmic', 'stellar', 'galactic', 'orbital', 'lunar', 'solar', 'nebula', 'pulsar', 
      'quasar', 'wormhole', 'blackhole', 'singularity', 'eventhorizon', 'supernova', 
      'constellation', 'galaxy', 'universe', 'multiverse', 'dimension', 'reality'
    ],
    fantasy: [
      'dragon', 'phoenix', 'wizard', 'mage', 'sorcerer', 'warlock', 'witch', 'arcane',
      'mythic', 'legend', 'rune', 'spell', 'enchanted', 'magic', 'magical', 'knight'
    ],
    nature: [
      'forest', 'jungle', 'rainforest', 'woodland', 'grove', 'thicket', 'copse', 'orchard',
      'vineyard', 'farm', 'field', 'meadow', 'pasture', 'prairie', 'savanna', 'steppe'
    ]
  };
  
  const allWords = [
    ...wordBanks.tech,
    ...wordBanks.space,
    ...wordBanks.fantasy,
    ...wordBanks.nature
  ];
  
  // Hash function
  function getHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  // Generate encrypted code
  function generateEncryptedCode(input) {
    const hash = getHash(input);
    const word1 = allWords[(hash * 1) % allWords.length];
    const word2 = allWords[(hash * 3) % allWords.length];
    const number = (hash % 9999).toString().padStart(4, '0');
    
    const formats = [
      `@${word1}-${word2}-${number}`,
      `@${word1.slice(0, 3)}-${word2.slice(0, 3)}-${number}`,
      `@${word1}-${number}-${word2}`,
      `@${word1.slice(0, 4)}${word2.slice(0, 3)}${number.slice(0, 3)}`
    ];
    
    return formats[hash % formats.length].toLowerCase();
  }
  
  // Generate fun @username
  function generateFunUsername(input) {
    const code = generateEncryptedCode(input + Date.now() + Math.random());
    return `/${code}`;
  }
  
  // In-memory storage
  const urlMappings = new Map();
  
  // Initialize with some sample mappings
  for (let i = 0; i < Math.min(20, allPages.length); i++) {
    const funUrl = generateFunUsername(`init${i}${allPages[i]}`);
    urlMappings.set(funUrl, allPages[i]);
  }
  
  // Handle reserved names redirect
  if (username && reservedNames.includes(username) && !path.startsWith('/@')) {
    return res.redirect(301, `/@${username}${path.substring(username.length + 1)}`);
  }
  
  // Handle /@ paths for backward compatibility
  if (path.startsWith('/@')) {
    const pathUsername = path.substring(2).split('?')[0].split('/')[0];
    
    if (!reservedNames.includes(pathUsername)) {
      // Check Supabase for user page
      try {
        const { data: page } = await supabase
          .from('user_pages')
          .select('*')
          .eq('page_id', pathUsername)
          .eq('is_public', true)
          .maybeSingle();
        
        if (page) {
          // Redirect to @username format (no slash)
          return res.redirect(301, `@${pathUsername}`);
        }
      } catch (error) {
        console.log(`ℹ️ No Supabase page for /@${pathUsername}:`, error.message);
      }
    }
  }
  
  // Check if it's a file path that should get a fun URL
  if (allPages.includes(path)) {
    const funUrl = generateFunUsername(path + Date.now());
    urlMappings.set(funUrl, path);
    
    console.log(`📄 File: ${path} → ${funUrl}`);
    
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Encrypted-URL', funUrl);
    res.setHeader('X-Original-File', path);
    
    return res.redirect(301, funUrl);
  }
  
  // Handle @ paths - ANY @anything gets mapped
  if (path.startsWith('/@')) {
    if (urlMappings.has(path)) {
      const targetFile = urlMappings.get(path);
      console.log(`🔑 Known @path: ${path} → ${targetFile}`);
      
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Target-File', targetFile);
      
      return res.redirect(302, targetFile);
    }
    
    const randomIndex = Math.floor(Math.random() * allPages.length);
    const targetFile = allPages[randomIndex];
    
    urlMappings.set(path, targetFile);
    console.log(`✨ NEW @path: ${path} → ${targetFile}`);
    
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-New-Mapping', 'true');
    res.setHeader('X-Target-File', targetFile);
    
    return res.redirect(302, targetFile);
  }
  
  // Handle direct requests to embed.html
  if (path === '/embed.html' && queryParams.has('url')) {
    const embedUrl = queryParams.get('url');
    console.log(`🌐 Direct Embed: ${path}?url=${embedUrl}`);
    
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv="refresh" content="0;url=/@embed/${encodeURIComponent(embedUrl)}">
        </head>
        <body>
          <p>Redirecting to embedded page...</p>
        </body>
      </html>
    `);
  }
  
  // Show system info
  if (path === '/url-system' || path === '/info') {
    let pageCount = 0;
    let topPages = [];
    
    try {
      const { count, error } = await supabase
        .from('user_pages')
        .select('*', { count: 'exact', head: true });
      
      if (!error) pageCount = count || 0;
      
      const { data, error: topError } = await supabase
        .from('user_pages')
        .select('page_id, title, views, created_at')
        .eq('is_public', true)
        .order('views', { ascending: false })
        .limit(10);
      
      if (!topError) topPages = data || [];
    } catch (error) {
      console.log('Supabase stats error:', error.message);
    }
    
    const samples = [];
    for (let i = 0; i < 10; i++) {
      samples.push(generateFunUsername(`sample${i}`));
    }
    
    return res.json({
      system: 'Pack CDN URL System v3.1',
      status: 'active',
      features: [
        '@username - User pages (Supabase)',
        '@random - Developer Panel',
        '@embed/* - Embedded websites',
        'Encrypted URLs',
        'HTML Content Rendering'
      ],
      stats: {
        userPages: pageCount,
        systemPages: allPages.length,
        topPages: topPages,
        totalWords: allWords.length,
        totalMappings: urlMappings.size
      },
      sampleUrls: samples,
      usage: [
        'pack-cdn.vercel.app@username - Access user page',
        'pack-cdn.vercel.app/@username - Alternative access',
        'pack-cdn.vercel.app@random - Create pages',
        'pack-cdn.vercel.app@embed/url - Embed websites'
      ]
    });
  }
  
  // For any other path, generate new encrypted URL
  const funUrl = generateFunUsername(path + Date.now());
  const randomIndex = Math.floor(Math.random() * allPages.length);
  const targetFile = allPages[randomIndex];
  
  urlMappings.set(funUrl, targetFile);
  
  console.log(`🚀 Random path: ${path} → ${funUrl} → ${targetFile}`);
  
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Generated-URL', funUrl);
  res.setHeader('X-Target-File', targetFile);
  
  return res.redirect(302, funUrl);
}

// ENHANCED renderUserPage with proper HTML handling
function renderUserPage(username, pageData) {
  console.log(`🖥️ Rendering page @${username} of type: ${pageData.page_type}`);
  
  // Get safe content based on page type
  let contentHtml = '';
  const tags = pageData.tags || [];
  const views = pageData.views || 0;
  const created = new Date(pageData.created_at).toLocaleDateString();
  
  switch(pageData.page_type) {
    case 'html':
      // For HTML pages, render the HTML directly (sanitized)
      contentHtml = sanitizeHTML(pageData.content || '');
      break;
      
    case 'embed':
      // For embed pages
      const embedUrl = pageData.content || '';
      contentHtml = `
        <div class="embed-container">
          <iframe 
            src="${embedUrl}" 
            style="width:100%; height:80vh; border:none; border-radius:15px;"
            allow="camera; microphone; geolocation; fullscreen"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
            title="${pageData.title}"
          ></iframe>
          <div class="embed-info">
            <strong>Embedded URL:</strong> 
            <a href="${embedUrl}" target="_blank" rel="noopener noreferrer">${embedUrl}</a>
          </div>
        </div>
      `;
      break;
      
    case 'markdown':
      // For markdown (you would need a markdown parser)
      contentHtml = `<div class="markdown-content">${escapeHTML(pageData.content || '')}</div>`;
      break;
      
    case 'dashboard':
      // For dashboard with multiple files
      const files = pageData.files || [];
      if (files.length > 0) {
        contentHtml = renderMultiFileDashboard(files, username);
      } else {
        contentHtml = `<div class="single-file">${escapeHTML(pageData.content || '')}</div>`;
      }
      break;
      
    default:
      // Plain text or unknown type
      contentHtml = `<div class="plain-content">${escapeHTML(pageData.content || '')}</div>`;
  }
  
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>${pageData.title} | @${username} | Pack CDN</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta property="og:title" content="${pageData.title}">
    <meta property="og:description" content="${pageData.description || 'User-created page on Pack CDN'}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://pack-cdn.vercel.app@${username}">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        color: #333;
        line-height: 1.6;
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
        overflow-x: auto;
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
      }
      .page-footer {
        text-align: center;
        margin-top: 40px;
        padding: 25px;
        background: rgba(255, 255, 255, 0.9);
        border-radius: 15px;
        color: #666;
      }
      h1 {
        font-size: 2.8rem;
        margin-bottom: 10px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .embed-container {
        margin: 20px 0;
      }
      .embed-info {
        margin-top: 15px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 10px;
      }
      
      /* Multi-file dashboard styles */
      .file-nav {
        background: #f8f9fa;
        border-radius: 10px;
        padding: 20px;
        margin-bottom: 20px;
      }
      .file-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 20px;
      }
      .file-tab {
        padding: 10px 20px;
        background: white;
        border: 2px solid #dee2e6;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s;
      }
      .file-tab.active {
        background: #667eea;
        color: white;
        border-color: #667eea;
      }
      .file-content {
        background: white;
        border-radius: 10px;
        padding: 20px;
        min-height: 300px;
      }
      
      @media (max-width: 768px) {
        .container { padding: 15px; }
        .page-header, .page-content { padding: 25px; }
        h1 { font-size: 2rem; }
        .action-bar { flex-direction: column; }
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
        <h1>${escapeHTML(pageData.title)}</h1>
        <div class="user-badge">@${username}</div>
        
        ${pageData.description ? `
          <p style="margin: 20px 0; color: #666; font-size: 1.1rem;">
            ${escapeHTML(pageData.description)}
          </p>
        ` : ''}
        
        ${tags.length > 0 ? `
          <div class="tags">
            ${tags.map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join('')}
          </div>
        ` : ''}
        
        <div class="page-stats">
          <div class="stat-item">👁️ ${views} views</div>
          <div class="stat-item">📅 Created ${created}</div>
          <div class="stat-item">🔄 ${pageData.version || 'v1'}</div>
          ${pageData.page_type ? `<div class="stat-item">📄 ${pageData.page_type}</div>` : ''}
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
      // Execute scripts for HTML pages safely
      if ('${pageData.page_type}' === 'html' || '${pageData.page_type}' === 'dashboard') {
        setTimeout(() => {
          const contentDiv = document.getElementById('content');
          const scripts = contentDiv.getElementsByTagName('script');
          for (let script of scripts) {
            try {
              const newScript = document.createElement('script');
              newScript.textContent = script.textContent;
              document.body.appendChild(newScript);
            } catch (e) {
              console.warn('Script execution skipped:', e.message);
            }
          }
        }, 100);
      }
      
      // Multi-file tab functionality
      document.addEventListener('click', (e) => {
        if (e.target.classList.contains('file-tab')) {
          const tabs = document.querySelectorAll('.file-tab');
          tabs.forEach(tab => tab.classList.remove('active'));
          e.target.classList.add('active');
          
          const fileId = e.target.dataset.file;
          const contents = document.querySelectorAll('.file-content-item');
          contents.forEach(content => {
            content.style.display = content.id === fileId ? 'block' : 'none';
          });
        }
      });
      
      console.log('📄 Page @${username} loaded');
    </script>
  </body>
</html>
  `;
}

// Helper functions
function escapeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sanitizeHTML(html) {
  // Basic sanitization - in production use DOMPurify or similar
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/g, '')
    .replace(/javascript:/gi, '');
}

function renderMultiFileDashboard(files, username) {
  if (files.length === 0) return '<p>No files in this dashboard.</p>';
  
  const tabs = files.map((file, index) => `
    <div class="file-tab ${index === 0 ? 'active' : ''}" data-file="file-${index}">
      ${file.name || `File ${index + 1}`} (${file.type || 'html'})
    </div>
  `).join('');
  
  const contents = files.map((file, index) => `
    <div id="file-${index}" class="file-content-item" style="${index === 0 ? '' : 'display: none;'}">
      ${file.type === 'html' ? file.content : `<pre>${escapeHTML(file.content)}</pre>`}
    </div>
  `).join('');
  
  return `
    <div class="file-nav">
      <h3>📁 Multi-File Dashboard</h3>
      <div class="file-tabs">
        ${tabs}
      </div>
    </div>
    <div class="file-content">
      ${contents}
    </div>
  `;
}
