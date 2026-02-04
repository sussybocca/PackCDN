// /api/embed-website.js
export default async function handler(req, res) {
  // Allow CORS for your domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { url, q } = req.query;
    let targetUrl = url;
    
    // If no URL provided but search query, use DuckDuckGo
    if (!targetUrl && q) {
      targetUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    }
    
    if (!targetUrl) {
      return res.status(400).json({ 
        error: 'URL parameter required. Use ?url=https://example.com or ?q=search+term' 
      });
    }
    
    // Ensure URL has protocol
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }
    
    // Clean URL for display
    const displayUrl = targetUrl.replace(/^https?:\/\//, '');
    
    return res.status(200).json({
      success: true,
      url: targetUrl,
      displayUrl: displayUrl,
      embedUrl: `/embed.html?url=${encodeURIComponent(targetUrl)}`,
      timestamp: new Date().toISOString(),
      type: 'website'
    });
    
  } catch (error) {
    console.error('Embed API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to process embed request',
      message: error.message 
    });
  }
}
