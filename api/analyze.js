// /api/analyze.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, packageName, packageType } = req.body;

  try {
    // Generate pack.json based on code analysis
    const packJson = {
      name: packageName,
      version: "1.0.0",
      type: packageType,
      dependencies: analyzeDependencies(code, packageType),
      entryPoints: findEntryPoints(code, packageType),
      files: [],
      createdAt: new Date().toISOString()
    };

    res.status(200).json({ 
      success: true, 
      packJson,
      fileStructure: suggestFileStructure(code, packageType)
    });
  } catch (error) {
    res.status(500).json({ error: 'Analysis failed' });
  }
}

function analyzeDependencies(code, type) {
  const deps = {};
  
  if (type === 'npm') {
    // Find imports in JS/TS
    const importRegex = /from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)/g;
    const matches = [...code.matchAll(importRegex)];
    matches.forEach(match => {
      const dep = match[1] || match[2];
      if (!dep.startsWith('.')) {
        const depName = dep.split('/')[0];
        deps[depName] = 'latest';
      }
    });
  } else if (type === 'python') {
    // Find imports in Python
    const importRegex = /^(?:import|from)\s+([\w\.]+)/gm;
    const matches = [...code.matchAll(importRegex)];
    matches.forEach(match => deps[match[1]] = '*');
  }
  
  return deps;
}

function findEntryPoints(code, type) {
  if (type === 'npm') {
    return code.includes('export default') ? ['index.js'] : ['main.js'];
  } else if (type === 'python') {
    return code.includes('def main') ? ['main.py'] : ['app.py'];
  }
  return ['index.js'];
}

function suggestFileStructure(code, type) {
  const structure = [];
  const fileName = type === 'python' ? 'main.py' : 'index.js';
  
  structure.push({
    path: fileName,
    content: code,
    isEntry: true
  });
  
  if (type === 'npm' && code.includes('export')) {
    structure.push({
      path: 'package.json',
      content: JSON.stringify({
        name: 'temp-package',
        version: '1.0.0',
        main: 'index.js'
      }, null, 2),
      isEntry: false
    });
  }
  
  return structure;
}
