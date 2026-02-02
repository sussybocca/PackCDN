// /api/publish-pack.js
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Enhanced rate limiting with exponential backoff
const rateLimitStore = new Map();
const RATE_LIMIT_CONFIG = {
  WINDOW_MS: 60 * 1000, // 1 minute
  MAX_REQUESTS: 5, // 5 requests per minute (reduced for security)
  BAN_WINDOW_MS: 15 * 60 * 1000, // 15 minute ban for violators
  BAN_THRESHOLD: 20 // Ban after 20 violations
};

// Allowed origins (strict)
const ALLOWED_ORIGINS = [
  'https://pack-cdn.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173'
];

// Reserved package names
const RESERVED_NAMES = [
  'pack', 'npm', 'node', 'js', 'python', 'wasm',
  'system', 'admin', 'root', 'config', 'setup',
  'install', 'update', 'remove', 'delete', 'create'
];

// File extension whitelist
const ALLOWED_EXTENSIONS = {
  'js': ['js', 'mjs', 'cjs'],
  'python': ['py', 'pyc', 'pyo'],
  'wasm': ['wasm'],
  'json': ['json'],
  'markdown': ['md', 'markdown'],
  'text': ['txt'],
  'html': ['html', 'htm'],
  'css': ['css'],
  'image': ['png', 'jpg', 'jpeg', 'gif', 'svg'],
  'data': ['csv', 'tsv', 'xml', 'yaml', 'yml']
};

export default async function handler(req, res) {
  // Start timing for performance monitoring
  const startTime = Date.now();
  
  // Enhanced CORS with stricter headers
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin) {
    // Log unauthorized origin attempts
    console.warn(`Unauthorized origin attempt: ${origin}`);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Origin, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  // Enhanced rate limiting with IP banning
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                   req.headers['x-real-ip'] || 
                   req.socket.remoteAddress;
  
  if (clientIp) {
    const requestData = rateLimitStore.get(clientIp) || { 
      count: 0, 
      resetTime: Date.now() + RATE_LIMIT_CONFIG.WINDOW_MS,
      violations: 0,
      bannedUntil: 0
    };
    
    // Check if IP is banned
    if (requestData.bannedUntil > Date.now()) {
      return res.status(429).json({
        success: false,
        error: 'IP address temporarily banned due to excessive requests',
        code: 'IP_BANNED',
        retryAfter: Math.ceil((requestData.bannedUntil - Date.now()) / 1000)
      });
    }
    
    const now = Date.now();
    
    if (now > requestData.resetTime) {
      // Reset counter for new window
      requestData.count = 1;
      requestData.resetTime = now + RATE_LIMIT_CONFIG.WINDOW_MS;
    } else {
      requestData.count++;
      
      if (requestData.count > RATE_LIMIT_CONFIG.MAX_REQUESTS) {
        requestData.violations++;
        
        // Ban IP if too many violations
        if (requestData.violations >= RATE_LIMIT_CONFIG.BAN_THRESHOLD) {
          requestData.bannedUntil = now + RATE_LIMIT_CONFIG.BAN_WINDOW_MS;
          console.warn(`IP banned: ${clientIp} for ${RATE_LIMIT_CONFIG.BAN_WINDOW_MS / 1000} seconds`);
        }
        
        rateLimitStore.set(clientIp, requestData);
        
        return res.status(429).json({
          success: false,
          error: `Rate limit exceeded. Maximum ${RATE_LIMIT_CONFIG.MAX_REQUESTS} requests per minute allowed.`,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((requestData.resetTime - now) / 1000)
        });
      }
    }
    
    rateLimitStore.set(clientIp, requestData);
  }

  // Validate Content-Type
  const contentType = req.headers['content-type'];
  if (!contentType || !contentType.includes('application/json')) {
    return res.status(415).json({
      success: false,
      error: 'Content-Type must be application/json',
      code: 'INVALID_CONTENT_TYPE'
    });
  }

  // Size limit check (10MB)
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > 10 * 1024 * 1024) {
    return res.status(413).json({
      success: false,
      error: 'Request body too large. Maximum 10MB allowed.',
      code: 'PAYLOAD_TOO_LARGE'
    });
  }

  try {
    const { name, packJson, files, isPublic = true } = req.body;

    // Validate required fields
    if (!name || !packJson || !files) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: name, packJson, and files are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Validate package name - STRICT ENFORCEMENT
    const nameValidation = validatePackageName(name);
    if (!nameValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid package name: ${nameValidation.reason}`,
        code: 'INVALID_PACKAGE_NAME'
      });
    }

    // Check for reserved names
    if (RESERVED_NAMES.includes(name.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `Package name "${name}" is reserved and cannot be used`,
        code: 'RESERVED_NAME'
      });
    }

    // Validate packJson
    let packJsonObj;
    try {
      packJsonObj = JSON.parse(packJson);
      
      // Additional packJson validation
      if (typeof packJsonObj !== 'object' || packJsonObj === null) {
        return res.status(400).json({
          success: false,
          error: 'packJson must be a valid JSON object',
          code: 'INVALID_PACK_JSON'
        });
      }
      
      // Validate packJson size
      const packJsonSize = JSON.stringify(packJsonObj).length;
      if (packJsonSize > 1024 * 1024) { // 1MB max for packJson
        return res.status(400).json({
          success: false,
          error: 'packJson too large. Maximum 1MB allowed.',
          code: 'PACK_JSON_TOO_LARGE'
        });
      }
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid packJson: Must be valid JSON',
        code: 'INVALID_JSON'
      });
    }

    // Validate files object structure
    if (typeof files !== 'object' || files === null || Array.isArray(files)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Files must be an object with filename: content pairs',
        code: 'INVALID_FILES_STRUCTURE'
      });
    }

    // File count limit
    const fileCount = Object.keys(files).length;
    if (fileCount > 50) { // Reduced from 100 to 50 for security
      return res.status(400).json({ 
        success: false, 
        error: 'Too many files. Maximum 50 files allowed per package.',
        code: 'TOO_MANY_FILES'
      });
    }

    if (fileCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one file is required',
        code: 'NO_FILES'
      });
    }

    // Validate individual files
    let totalSize = 0;
    const MAX_TOTAL_SIZE = 5 * 1024 * 1024; // Reduced to 5MB total for security
    const processedFiles = {};
    
    for (const [filename, content] of Object.entries(files)) {
      // Validate filename
      const filenameValidation = validateFilename(filename);
      if (!filenameValidation.valid) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid filename: ${filenameValidation.reason}`,
          code: 'INVALID_FILENAME'
        });
      }

      // Validate content type and size
      if (typeof content !== 'string') {
        return res.status(400).json({ 
          success: false, 
          error: `File content must be a string: ${filename}`,
          code: 'INVALID_CONTENT_TYPE'
        });
      }

      // Check content size
      const fileSize = content.length;
      totalSize += fileSize;
      
      // Individual file size limit (reduced for security)
      if (fileSize > 2 * 1024 * 1024) { // 2MB per file
        return res.status(400).json({ 
          success: false, 
          error: `File too large: ${filename}. Maximum 2MB per file.`,
          code: 'FILE_TOO_LARGE'
        });
      }

      // Check for empty files
      if (fileSize === 0) {
        return res.status(400).json({
          success: false,
          error: `File cannot be empty: ${filename}`,
          code: 'EMPTY_FILE'
        });
      }

      // File extension validation
      const ext = filename.split('.').pop().toLowerCase();
      const fileType = getFileType(ext);
      
      if (!fileType) {
        return res.status(400).json({
          success: false,
          error: `Unsupported file extension: .${ext}`,
          code: 'UNSUPPORTED_EXTENSION'
        });
      }

      // Content validation based on file type
      const contentValidation = validateFileContent(filename, content, fileType);
      if (!contentValidation.valid) {
        return res.status(400).json({
          success: false,
          error: `Invalid content in ${filename}: ${contentValidation.reason}`,
          code: 'INVALID_CONTENT'
        });
      }

      // Store sanitized content
      processedFiles[filename] = content;
    }

    // Total package size limit
    if (totalSize > MAX_TOTAL_SIZE) {
      return res.status(400).json({ 
        success: false, 
        error: `Package too large. Total size: ${(totalSize / 1024 / 1024).toFixed(2)}MB. Maximum 5MB per package.`,
        code: 'PACKAGE_TOO_LARGE'
      });
    }

    // Check for duplicate package name BEFORE generating IDs
    const { data: existingPack, error: checkError } = await supabase
      .from('packs')
      .select('id, name, created_at')
      .eq('name', name)
      .limit(1);

    if (checkError) {
      console.error('Duplicate check error:', checkError);
      return res.status(500).json({
        success: false,
        error: 'Internal server error during duplicate check',
        code: 'DUPLICATE_CHECK_FAILED'
      });
    }

    // BLOCK DUPLICATE PACKAGE NAMES
    if (existingPack && existingPack.length > 0) {
      const existing = existingPack[0];
      const createdAt = new Date(existing.created_at).toLocaleDateString();
      
      return res.status(409).json({
        success: false,
        error: `Package name "${name}" is already taken. Package names must be unique.`,
        code: 'PACKAGE_NAME_EXISTS',
        existingPackageId: existing.id,
        existingPackageCreated: createdAt
      });
    }

    // Generate cryptographically secure URL ID
    const urlId = generateSecureUrlId();
    
    // Verify URL ID uniqueness
    const { data: existingUrlId } = await supabase
      .from('packs')
      .select('id')
      .eq('url_id', urlId)
      .limit(1);

    if (existingUrlId && existingUrlId.length > 0) {
      // Extremely unlikely but handle collision
      return res.status(500).json({
        success: false,
        error: 'Internal server error: URL ID collision',
        code: 'URL_ID_COLLISION'
      });
    }

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

    // Generate a checksum of the package for verification
    const packageChecksum = generateChecksum(JSON.stringify(processedFiles));

    // Save to Supabase with transaction (if supported)
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('packs')
      .insert([{
        url_id: urlId,
        name,
        pack_json: packJson,
        files: processedFiles,
        cdn_url: cdnUrl,
        worker_url: workerUrl,
        encrypted_key: encryptedKey,
        is_public: isPublic,
        package_type: packageType,
        version: version,
        checksum: packageChecksum,
        file_count: fileCount,
        total_size: totalSize,
        created_at: now,
        updated_at: now,
        views: 0,
        downloads: 0,
        publish_ip: clientIp,
        last_accessed: now
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      
      // Check for specific constraint violations
      if (error.code === '23505') { // Unique violation
        // This should not happen with our pre-check, but handle just in case
        return res.status(409).json({ 
          success: false, 
          error: 'Package with this name already exists',
          code: 'DUPLICATE_PACKAGE'
        });
      }
      
      // Log detailed error for debugging but return generic message
      console.error('Database error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to save package. Please try again.',
        code: 'DATABASE_ERROR'
      });
    }

    // Log successful publish with audit trail
    const processingTime = Date.now() - startTime;
    console.log(`Package published successfully:`, {
      name,
      urlId,
      packageType,
      fileCount,
      totalSize: `${(totalSize / 1024).toFixed(2)}KB`,
      processingTime: `${processingTime}ms`,
      clientIp,
      timestamp: now,
      checksum: packageChecksum
    });

    // Audit log to Supabase (optional separate table)
    try {
      await supabase
        .from('publish_audit_log')
        .insert([{
          pack_id: data.id,
          pack_name: name,
          client_ip: clientIp,
          file_count: fileCount,
          total_size: totalSize,
          is_public: isPublic,
          created_at: now
        }]);
    } catch (auditError) {
      // Don't fail the publish if audit logging fails
      console.warn('Audit logging failed:', auditError);
    }

    // Return success response with additional metadata
    res.status(201).json({
      success: true,
      packId: data.id,
      urlId: urlId,
      cdnUrl,
      workerUrl,
      installCommand: `pack install ${name} ${cdnUrl}`,
      encryptedKey,
      metadata: {
        name,
        version,
        packageType,
        fileCount,
        totalSize,
        isPublic,
        createdAt: now,
        checksum: packageChecksum
      },
      links: {
        cdn: cdnUrl,
        info: workerUrl,
        download: `${cdnUrl}/index.js`,
        api: `/api/get-pack?id=${urlId}`
      }
    });

  } catch (error) {
    // Comprehensive error logging
    console.error('Publish error:', {
      message: error.message,
      stack: error.stack,
      clientIp,
      timestamp: new Date().toISOString(),
      processingTime: `${Date.now() - startTime}ms`
    });
    
    // Don't expose internal error details to client
    res.status(500).json({ 
      success: false, 
      error: 'An unexpected error occurred. Please try again later.',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
}

// Enhanced helper functions

function validatePackageName(name) {
  if (typeof name !== 'string') {
    return { valid: false, reason: 'Package name must be a string' };
  }
  
  if (name.length < 2) {
    return { valid: false, reason: 'Package name must be at least 2 characters' };
  }
  
  if (name.length > 50) {
    return { valid: false, reason: 'Package name cannot exceed 50 characters' };
  }
  
  // Must start with a letter
  if (!/^[a-z]/.test(name)) {
    return { valid: false, reason: 'Package name must start with a lowercase letter' };
  }
  
  // Only lowercase letters, numbers, hyphens, and underscores
  if (!/^[a-z0-9-_]+$/.test(name)) {
    return { valid: false, reason: 'Package name can only contain lowercase letters, numbers, hyphens, and underscores' };
  }
  
  // Cannot end with hyphen or underscore
  if (/[-_]$/.test(name)) {
    return { valid: false, reason: 'Package name cannot end with a hyphen or underscore' };
  }
  
  // No consecutive hyphens or underscores
  if (/[-_]{2,}/.test(name)) {
    return { valid: false, reason: 'Package name cannot contain consecutive hyphens or underscores' };
  }
  
  // Check for offensive patterns (basic)
  const offensivePatterns = [
    /admin/i,
    /root/i,
    /system/i,
    /config/i,
    /password/i,
    /token/i,
    /secret/i,
    /private/i
  ];
  
  if (offensivePatterns.some(pattern => pattern.test(name))) {
    return { valid: false, reason: 'Package name contains restricted patterns' };
  }
  
  return { valid: true };
}

function validateFilename(filename) {
  if (typeof filename !== 'string') {
    return { valid: false, reason: 'Filename must be a string' };
  }
  
  if (filename.length === 0) {
    return { valid: false, reason: 'Filename cannot be empty' };
  }
  
  if (filename.length > 255) {
    return { valid: false, reason: 'Filename cannot exceed 255 characters' };
  }
  
  // Basic character validation
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return { valid: false, reason: 'Filename can only contain letters, numbers, dots, hyphens, and underscores' };
  }
  
  // Prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return { valid: false, reason: 'Filename cannot contain directory traversal characters' };
  }
  
  // No hidden files (starting with dot) except .gitignore, .env, etc.
  if (filename.startsWith('.') && !['.gitignore', '.env', '.npmrc', '.prettierrc'].includes(filename)) {
    return { valid: false, reason: 'Hidden files are not allowed' };
  }
  
  // Reserved filenames
  const reservedFilenames = [
    'index.js', 'main.js', 'app.js', 'server.js', 
    'package.json', 'package-lock.json', 'yarn.lock',
    'node_modules', 'vendor', 'lib', 'bin'
  ];
  
  if (reservedFilenames.includes(filename.toLowerCase())) {
    return { valid: false, reason: 'Filename is reserved for system use' };
  }
  
  // Extension validation
  const ext = filename.split('.').pop().toLowerCase();
  if (!ext || ext === filename) {
    return { valid: false, reason: 'Filename must have an extension' };
  }
  
  return { valid: true };
}

function getFileType(extension) {
  for (const [type, exts] of Object.entries(ALLOWED_EXTENSIONS)) {
    if (exts.includes(extension)) {
      return type;
    }
  }
  return null;
}

function validateFileContent(filename, content, fileType) {
  // Check for null bytes and other control characters
  if (/\x00/.test(content)) {
    return { valid: false, reason: 'File contains null bytes' };
  }
  
  // Check for extremely long lines (potential DoS)
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.length > 10000) {
      return { valid: false, reason: 'File contains excessively long lines' };
    }
  }
  
  // Type-specific validation
  switch (fileType) {
    case 'js':
      return validateJavaScript(content);
    case 'json':
      return validateJSON(content);
    case 'python':
      return validatePython(content);
    case 'wasm':
      return validateWASM(content);
    case 'html':
      return validateHTML(content);
    default:
      // For other types, just do basic validation
      return { valid: true };
  }
}

function validateJavaScript(content) {
  const dangerousPatterns = [
    // Execution patterns
    /\beval\s*\(/i,
    /\bFunction\s*\(/i,
    /new\s+Function\s*\(/i,
    /\bsetTimeout\s*\([^)]*\)/i,
    /\bsetInterval\s*\([^)]*\)/i,
    /\bsetImmediate\s*\([^)]*\)/i,
    
    // File system access (Node.js)
    /\bfs\s*\./i,
    /\brequire\s*\([^)]*\)/i,
    /\bprocess\s*\./i,
    /\bchild_process\s*\./i,
    
    // Network access
    /\bfetch\s*\([^)]*\)/i,
    /\bXMLHttpRequest/i,
    /\bwebsocket/i,
    
    // Storage access
    /\blocalStorage\s*\./i,
    /\bsessionStorage\s*\./i,
    /\bindexedDB/i,
    /\bcookie/i,
    
    // DOM manipulation (if running in browser context)
    /\bdocument\s*\./i,
    /\bwindow\s*\./i,
    /\balert\s*\(/i,
    /\bconfirm\s*\(/i,
    /\bprompt\s*\(/i,
    
    // Crypto mining
    /\bcrypto\s*\./i,
    /\bminer/i,
    /\bcoin/i,
    
    // Obfuscated code indicators
    /\bunescape\s*\(/i,
    /\batob\s*\(/i,
    /\bbtoa\s*\(/i,
    
    // Suspicious strings
    /base64/i,
    /eval/i,
    /exec/i,
    /spawn/i,
    /shell/i
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      return { 
        valid: false, 
        reason: 'JavaScript contains potentially dangerous patterns'
      };
    }
  }
  
  // Check for minified code (very long lines)
  const avgLineLength = content.length / (content.split('\n').length || 1);
  if (avgLineLength > 500) {
    return { valid: false, reason: 'JavaScript appears to be minified or obfuscated' };
  }
  
  return { valid: true };
}

function validateJSON(content) {
  try {
    JSON.parse(content);
    return { valid: true };
  } catch (e) {
    return { valid: false, reason: 'Invalid JSON format' };
  }
}

function validatePython(content) {
  const dangerousPatterns = [
    /\bimport\s+os\b/,
    /\bimport\s+sys\b/,
    /\bimport\s+subprocess\b/,
    /\beval\s*\(/,
    /\bexec\s*\(/,
    /\bcompile\s*\(/,
    /\bopen\s*\(/,
    /\b__import__\s*\(/,
    /\binput\s*\(/,
    /\braw_input\s*\(/,
    /\bpickle\b/,
    /\bshelve\b/,
    /\bmarshal\b/
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      return { 
        valid: false, 
        reason: 'Python contains potentially dangerous imports or functions'
      };
    }
  }
  
  return { valid: true };
}

function validateWASM(content) {
  // Basic WASM validation (magic number)
  if (content.length < 8) {
    return { valid: false, reason: 'Invalid WASM file: too short' };
  }
  
  // Check for base64 encoding
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(content)) {
    // It's base64 encoded, decode first
    try {
      const binary = atob(content);
      const header = new Uint8Array(binary.split('').map(c => c.charCodeAt(0)));
      
      // Check WASM magic number: \0asm
      if (header[0] !== 0 || header[1] !== 0x61 || header[2] !== 0x73 || header[3] !== 0x6D) {
        return { valid: false, reason: 'Invalid WASM file: incorrect magic number' };
      }
    } catch (e) {
      return { valid: false, reason: 'Invalid base64 encoding for WASM file' };
    }
  } else {
    // Assume it's binary string
    if (content.charCodeAt(0) !== 0 || 
        content.charCodeAt(1) !== 0x61 ||
        content.charCodeAt(2) !== 0x73 ||
        content.charCodeAt(3) !== 0x6D) {
      return { valid: false, reason: 'Invalid WASM file: incorrect magic number' };
    }
  }
  
  return { valid: true };
}

function validateHTML(content) {
  const dangerousPatterns = [
    /<script[^>]*>/i,
    /javascript:/i,
    /data:/i,
    /onload=/i,
    /onerror=/i,
    /onclick=/i,
    /eval\s*\(/i
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      return { 
        valid: false, 
        reason: 'HTML contains potentially dangerous scripts or attributes'
      };
    }
  }
  
  return { valid: true };
}

function generateSecureUrlId() {
  // Cryptographically secure random string with timestamp
  return crypto.randomBytes(12).toString('hex') + 
         Date.now().toString(36) +
         crypto.randomBytes(4).toString('hex');
}

function generateSecureEncryptionKey() {
  // Generate cryptographically secure random key
  return crypto.randomBytes(32).toString('hex');
}

function sanitizeVersion(version) {
  if (typeof version !== 'string') return '1.0.0';
  
  // Allow only numbers and dots for version
  const sanitized = version.replace(/[^0-9.]/g, '');
  
  // Ensure proper format (at least one dot)
  if (!sanitized.includes('.')) {
    return sanitized + '.0.0';
  }
  
  // Remove leading/trailing dots
  const parts = sanitized.split('.').filter(part => part !== '');
  if (parts.length === 0) return '1.0.0';
  
  // Ensure each part is numeric
  const numericParts = parts.map(part => {
    const num = parseInt(part, 10);
    return isNaN(num) ? '0' : num.toString();
  });
  
  // Pad to at least 3 parts
  while (numericParts.length < 3) {
    numericParts.push('0');
  }
  
  // Limit to 5 parts max
  return numericParts.slice(0, 5).join('.');
}

function generateChecksum(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Cleanup function for rate limiting store
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitStore.entries()) {
    // Clean entries older than 1 hour
    if (now > data.resetTime + 60 * 60 * 1000 && data.bannedUntil < now) {
      rateLimitStore.delete(ip);
    }
  }
}, 5 * 60 * 1000); // Run cleanup every 5 minutes

// Export for testing
if (process.env.NODE_ENV === 'test') {
  module.exports = {
    validatePackageName,
    validateFilename,
    validateFileContent,
    sanitizeVersion,
    generateSecureUrlId
  };
}
