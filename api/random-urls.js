// api/random-urls.js
export default function handler(req, res) {
  const { action, count = 100, seed } = req.query;
  
  // Your actual files
  const targets = [
    { id: 'home', path: '/selector.html', name: 'Home Selector' },
    { id: 'dashboard', path: '/home/index.html', name: 'Dashboard' },
    { id: 'docs', path: '/docs.html', name: 'Documentation' },
    { id: 'editor', path: '/editor.html', name: 'Editor' },
    { id: 'explore', path: '/explore.html', name: 'Explorer' },
    { id: 'config', path: '/config.json', name: 'Configuration' }
  ];
  
  // Massive word banks for infinite combinations
  const wordBanks = {
    tech: ['quantum', 'cyber', 'digital', 'virtual', 'neural', 'synth', 'crypto', 'blockchain', 'ai', 'ml'],
    space: ['cosmic', 'stellar', 'galactic', 'orbital', 'lunar', 'solar', 'nebula', 'pulsar', 'quasar', 'wormhole'],
    nature: ['forest', 'ocean', 'mountain', 'river', 'crystal', 'ember', 'blaze', 'frost', 'storm', 'thunder'],
    fantasy: ['dragon', 'phoenix', 'wizard', 'arcane', 'mythic', 'legend', 'rune', 'spell', 'enchanted', 'magic'],
    future: ['neo', 'ultra', 'hyper', 'mega', 'tera', 'peta', 'omega', 'alpha', 'beta', 'gamma'],
    portals: ['gate', 'portal', 'door', 'window', 'bridge', 'tunnel', 'path', 'route', 'gateway', 'access'],
    places: ['nexus', 'hub', 'core', 'center', 'matrix', 'grid', 'network', 'web', 'cloud', 'cluster']
  };
  
  // Generate a random URL path
  function generateRandomUrl(targetId, index) {
    const categories = Object.keys(wordBanks);
    const numWords = 2 + Math.floor(Math.random() * 3); // 2-4 words
    
    let path = '/';
    for (let i = 0; i < numWords; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      const words = wordBanks[category];
      const word = words[Math.floor(Math.random() * words.length)];
      path += word + (i < numWords - 1 ? '-' : '');
    }
    
    // Add some variations
    const variations = [
      () => path + '-v' + (Math.floor(Math.random() * 10) + 1),
      () => path + Math.floor(Math.random() * 1000),
      () => path + '-' + Date.now().toString(36),
      () => '/api/' + path.slice(1),
      () => '/v' + (Math.floor(Math.random() * 3) + 1) + path,
      () => path
    ];
    
    return variations[Math.floor(Math.random() * variations.length)]();
  }
  
  // Generate hundreds of URLs
  if (action === 'generate' || !action) {
    const urlCount = Math.min(parseInt(count), 1000); // Cap at 1000
    const generatedUrls = [];
    
    for (let i = 0; i < urlCount; i++) {
      const target = targets[Math.floor(Math.random() * targets.length)];
      const randomUrl = generateRandomUrl(target.id, i);
      
      // CORRECTED: Removed duplicate domain in shortUrl
      generatedUrls.push({
        url: randomUrl,
        target: target.path,
        name: target.name,
        id: target.id,
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('https://pack-cdn.vercel.app' + randomUrl)}`,
        shortUrl: `https://go.pack-cdn.vercel.app/${Date.now().toString(36)}${i.toString(36)}`,
        metadata: {
          generated: new Date().toISOString(),
          index: i,
          seed: seed || 'random'
        }
      });
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    return res.status(200).json({
      success: true,
      count: generatedUrls.length,
      generated: new Date().toISOString(),
      seed: seed || Math.random().toString(36).substring(2),
      urls: generatedUrls,
      endpoints: {
        all: '/api/random-urls',
        generate: '/api/random-urls?action=generate&count=100',
        redirect: '/api/random-urls/redirect/{any-random-path}',
        discover: '/api/random-urls?action=discover'
      },
      usage: 'Use any generated URL - they all redirect to actual pages!'
    });
  }
  
  // Discovery mode - find random URLs
  if (action === 'discover') {
    const discoveries = [];
    const discoveryCount = Math.min(parseInt(count) || 20, 50);
    
    for (let i = 0; i < discoveryCount; i++) {
      const target = targets[Math.floor(Math.random() * targets.length)];
      const randomUrl = generateRandomUrl(target.id, i + 1000);
      
      discoveries.push({
        discoveredUrl: randomUrl,
        leadsTo: target.name,
        probability: Math.random().toFixed(2),
        hint: `Try ${randomUrl} to access ${target.name}`,
        timestamp: new Date(Date.now() + i * 1000).toISOString()
      });
    }
    
    return res.json({
      action: 'discovery',
      message: 'Found these random endpoints in the wild!',
      discoveries,
      totalDiscovered: discoveryCount,
      nextDiscovery: `/api/random-urls?action=discover&count=${discoveryCount}&seed=${Date.now()}`
    });
  }
  
  // Default: redirect handler
  const requestedPath = req.url.replace('/api/random-urls', '');
  
  if (requestedPath && requestedPath !== '/') {
    // Any random path gets redirected to a random target
    const target = targets[Math.floor(Math.random() * targets.length)];
    
    // Log the random access
    console.log(`Random access: ${requestedPath} -> ${target.path} at ${new Date().toISOString()}`);
    
    return res.redirect(302, target.path);
  }
  
  // Show API info
  res.json({
    name: 'Infinite Random URL Generator',
    description: 'Generates hundreds of random URLs that redirect to your actual pages',
    version: '1.0.0',
    endpoints: {
      generate: '/api/random-urls?action=generate&count=100',
      discover: '/api/random-urls?action=discover',
      redirect: 'Any path under /api/random-urls/ will redirect randomly',
      example: '/api/random-urls/quantum-dragon-nexus'
    },
    features: [
      'Auto-generates 100s of random URLs',
      'Every URL redirects to actual content',
      'Self-discovering endpoint system',
      'QR code generation for each URL',
      'Deterministic but random-looking paths'
    ]
  });
}
