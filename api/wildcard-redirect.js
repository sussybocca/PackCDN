// api/wildcard-redirect.js
export default function handler(req, res) {
  const path = req.url;
  
  // Your actual files
  const destinations = [
    '/selector.html',
    '/home/index.html',
    '/docs.html',
    '/editor.html', 
    '/explore.html',
    '/config.json'
  ];
  
  // Deterministic redirect based on path hash
  function getDestination(inputPath) {
    let hash = 0;
    for (let i = 0; i < inputPath.length; i++) {
      hash = ((hash << 5) - hash) + inputPath.charCodeAt(i);
      hash = hash & hash;
    }
    return destinations[Math.abs(hash) % destinations.length];
  }
  
  const destination = getDestination(path);
  res.redirect(302, destination);
}
