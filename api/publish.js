// /api/publish-pack.js
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Rate limiting in-memory store (for serverless functions)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // 10 requests per minute

// Allowed origins (for CORS)
const ALLOWED_ORIGINS = [
  'https://pack-cdn.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
];

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Origin');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  // Rate limiting by IP
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  
  if (clientIp) {
    const requestData = rateLimitStore.get(clientIp) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };
    
    if (now > requestData.resetTime) {
      // Reset counter
      requestData.count = 1;
      requestData.resetTime = now + RATE_LIMIT_WINDOW_MS;
    } else {
      requestData.count++;
    }
    
    rateLimitStore.set(clientIp, requestData);
    
    // Clean up old entries
    for (const [ip, data] of rateLimitStore.entries()) {
      if (now > data.resetTime) {
        rateLimitStore.delete(ip);
      }
    }
    
    if (requestData.count > MAX_REQUESTS_PER_WINDOW) {
      return res.status(429).json({ 
        success: false, 
        error: 'Too many requests. Please try again later.' 
      });
    }
  }

  const { name, packJson, files, isPublic = true } = req.body;

  try {
    // Validate required fields
    if (!name || !packJson || !files) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: name, packJson, and files are required' 
      });
    }

    // Validate package name
    if (!isValidPackageName(name)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid package name. Use only lowercase letters, numbers, hyphens, and underscores. Must start with a letter.' 
      });
    }

    // Validate packJson
    let packJsonObj;
    try {
      packJsonObj = JSON.parse(packJson);
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid packJson: Must be valid JSON' 
      });
    }

    // Validate files object
    if (typeof files !== 'object' || files === null || Array.isArray(files)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Files must be an object with filename: content pairs' 
      });
    }

    // File count limit
    const fileCount = Object.keys(files).length;
    if (fileCount > 100) {
      return res.status(400).json({ 
        success: false, 
        error: 'Too many files. Maximum 100 files allowed per package.' 
      });
    }

    // Validate individual files
    let totalSize = 0;
    const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB total
    
    for (const [filename, content] of Object.entries(files)) {
      // Validate filename
      if (!isValidFilename(filename)) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid filename: ${filename}. Filenames must be alphanumeric with dots, hyphens, and underscores only.` 
        });
      }

      // Validate content type
      if (typeof content !== 'string') {
        return res.status(400).json({ 
          success: false, 
          error: `File content must be a string: ${filename}` 
        });
      }

      // Check content size
      totalSize += content.length;
      
      // File size limit (individual)
      if (content.length > 5 * 1024 * 1024) { // 5MB per file
        return res.status(400).json({ 
          success: false, 
          error: `File too large: ${filename}. Maximum 5MB per file.` 
        });
      }

      // Security: Check for potentially malicious patterns in JS files
      if (filename.endsWith('.js') || filename.endsWith('.mjs') || filename.endsWith('.cjs')) {
        if (containsDangerousPatterns(content)) {
          return res.status(400).json({ 
            success: false, 
            error: `Security violation detected in ${filename}. File contains potentially dangerous patterns.` 
          });
        }
      }
    }

    // Total package size limit
    if (totalSize > MAX_TOTAL_SIZE) {
      return res.status(400).json({ 
        success: false, 
        error: `Package too large. Total size: ${(totalSize / 1024 / 1024).toFixed(2)}MB. Maximum 10MB per package.` 
      });
    }

    // Generate cryptographically secure URL ID
    const urlId = generateSecureUrlId();
    const cdnUrl = `https://packcdn.firefly-worker.workers.dev/cdn/${urlId}`;
    const workerUrl = `https://packcdn.firefly-worker.workers.dev/pack/${urlId}`;
    
    // Generate cryptographically secure encryption key for private packages
    const encryptedKey = !isPublic ? generateSecureEncryptionKey() : null;

    // Map frontend package types to valid database package types
    let packageType = 'npm';
    
    if (packJsonObj.type) {
      const typeMap = {
        'module': 'npm',
        'library': 'npm', 
        'template': 'npm',
        'plugin': 'npm',
        'python': 'python',
        'wasm': 'wasm'
      };
      
      const frontendType = packJsonObj.type.toLowerCase();
      packageType = typeMap[frontendType] || 'npm';
    }

    // Extract and sanitize version
    let version = '1.0.0';
    if (packJsonObj.version) {
      version = sanitizeVersion(packJsonObj.version);
    }

    // Check for duplicate package name (optional but recommended)
    const { data: existingPack, error: checkError } = await supabase
      .from('packs')
      .select('id')
      .eq('name', name)
      .limit(1);

    if (checkError) {
      console.error('Duplicate check error:', checkError);
      // Continue anyway, don't block on duplicate check failure
    }

    if (existingPack && existingPack.length > 0) {
      // Allow duplicates but warn in logs
      console.warn(`Duplicate package name detected: ${name}`);
    }

    // Save to Supabase with timestamp
    const { data, error } = await supabase
      .from('packs')
      .insert([{
        url_id: urlId,
        name,
        pack_json: packJson,
        files,
        cdn_url: cdnUrl,
        worker_url: workerUrl,
        encrypted_key: encryptedKey,
        is_public: isPublic,
        package_type: packageType,
        version: version,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        views: 0,
        downloads: 0
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      
      // Check for specific constraint violations
      if (error.code === '23505') { // Unique violation
        return res.status(409).json({ 
          success: false, 
          error: 'Package with this name already exists or URL ID conflict' 
        });
      }
      
      throw error;
    }

    // Log successful publish (without sensitive data)
    console.log(`Package published: ${name} (${urlId}) by IP: ${clientIp}`);

    // Return success response
    res.status(200).json({
      success: true,
      packId: data.id,
      urlId: urlId,
      cdnUrl,
      workerUrl,
      installCommand: `pack install ${name} ${cdnUrl}`,
      encryptedKey,
      warning: existingPack && existingPack.length > 0 ? 
        'Note: A package with this name already exists.' : undefined
    });

  } catch (error) {
    console.error('Publish error:', {
      message: error.message,
      stack: error.stack,
      clientIp: clientIp,
      timestamp: new Date().toISOString()
    });
    
    // Don't expose internal error details to client
    res.status(500).json({ 
      success: false, 
      error: 'Publish failed. Please try again later.' 
    });
  }
}

// Helper functions

function isValidPackageName(name) {
  // Package naming conventions: lowercase, letters, numbers, hyphens, underscores
  // Must start with a letter
  const packageNameRegex = /^[a-z][a-z0-9-_]*$/;
  return typeof name === 'string' && 
         name.length >= 1 && 
         name.length <= 50 && 
         packageNameRegex.test(name);
}

function isValidFilename(filename) {
  // Basic filename validation
  const filenameRegex = /^[a-zA-Z0-9._-]+$/;
  return typeof filename === 'string' && 
         filename.length > 0 && 
         filename.length <= 255 && 
         filenameRegex.test(filename) &&
         !filename.includes('..') && // Prevent directory traversal
         !filename.startsWith('.') && // No hidden files
         filename !== '.' &&
         filename !== '..';
}

function containsDangerousPatterns(content) {
  // Check for potentially dangerous patterns in JavaScript
  const dangerousPatterns = [
    /\beval\s*\(/i,
    /\bFunction\s*\(/i,
    /new\s+Function/i,
    /\bsetTimeout\s*\([^,]*,\s*[^)]*\)/i,
    /\bsetInterval\s*\([^,]*,\s*[^)]*\)/i,
    /\bexec\s*\(/i,
    /\bshell\s*\(/i,
    /document\.cookie/i,
    /localStorage\./i,
    /sessionStorage\./i,
    /XMLHttpRequest/i,
    /fetch\s*\([^)]*\)/i,
    /import\s*\(/i,
    /require\s*\([^)]*\)/i
  ];
  
  // These are just examples - adjust based on your security requirements
  // In production, you might want a more sophisticated analysis
  return dangerousPatterns.some(pattern => pattern.test(content));
}

function generateSecureUrlId() {
  // Cryptographically secure random string
  return crypto.randomBytes(16).toString('hex') + 
         Date.now().toString(36);
}

function generateSecureEncryptionKey() {
  // Generate cryptographically secure random key
  return crypto.randomBytes(32).toString('base64');
}

function sanitizeVersion(version) {
  // Basic version sanitization
  if (typeof version !== 'string') return '1.0.0';
  
  // Remove any non-version characters
  const sanitized = version.replace(/[^0-9.]/g, '');
  
  // Ensure it's not empty
  return sanitized || '1.0.0';
}

// Add cleanup function for rate limiting store
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitStore.entries()) {
    if (now > data.resetTime + 5 * 60 * 1000) { // Clean entries older than 5 minutes
      rateLimitStore.delete(ip);
    }
  }
}, 60 * 1000); // Run cleanup every minute
