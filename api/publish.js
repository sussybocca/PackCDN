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
  WINDOW_MS: 60 * 1000,
  MAX_REQUESTS: 10,
  BAN_WINDOW_MS: 15 * 60 * 1000,
  BAN_THRESHOLD: 20
};

// Allowed origins
const ALLOWED_ORIGINS = [
  'https://pack-cdn.vercel.app',
  'https://pack-dash.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173'
];

// Reserved package names
const RESERVED_NAMES = [
  'pack', 'npm', 'node', 'js', 'python', 'wasm',
  'system', 'admin', 'root', 'config', 'setup',
  'install', 'update', 'remove', 'delete', 'create'
];

// File extension whitelist with expanded support
const ALLOWED_EXTENSIONS = {
  'js': ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx'],
  'python': ['py', 'pyc', 'pyo'],
  'wasm': ['wasm'],
  'json': ['json'],
  'markdown': ['md', 'markdown'],
  'text': ['txt'],
  'html': ['html', 'htm'],
  'css': ['css', 'scss', 'sass'],
  'image': ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'],
  'data': ['csv', 'tsv', 'xml', 'yaml', 'yml'],
  'binary': ['bin', 'dat']
};

// ESSENTIAL PACKAGE FILES
const ESSENTIAL_FILES = [
  'package.json',
  'index.js',
  'main.js',
  'app.js',
  'server.js',
  'README.md',
  'LICENSE',
  'LICENSE.txt',
  'README.txt',
  'CHANGELOG.md',
  'CONTRIBUTING.md'
];

// ALLOWED NODE.JS MODULES FOR ADVANCED PACKAGES (whitelist)
const ALLOWED_NODE_MODULES = [
  // Core modules (generally safe)
  'crypto', 'util', 'events', 'stream', 'buffer', 'path', 'url', 'querystring',
  'string_decoder', 'timers', 'console',
  
  // Common utility modules
  'lodash', 'underscore', 'moment', 'date-fns', 'axios', 'node-fetch',
  'uuid', 'validator', 'joi', 'yup',
  
  // Data processing
  'csv-parse', 'csv-stringify', 'jsonwebtoken', 'bcrypt', 'bcryptjs',
  
  // Safe utility modules
  'chalk', 'colors', 'debug', 'winston', 'pino',
  
  // File formats
  'yaml', 'xml2js', 'cheerio',
  
  // Testing (safe)
  'jest', 'mocha', 'chai', 'sinon'
];

// BANNED NODE.JS MODULES (blacklist)
const BANNED_NODE_MODULES = [
  'child_process', 'cluster', 'worker_threads', 'vm',
  'fs', 'os', 'net', 'dns', 'tls', 'http', 'https',
  'dgram', 'zlib', 'perf_hooks', 'repl', 'readline',
  'module', 'process'
];

// Package types with their capabilities
const PACKAGE_TYPES = {
  'basic': {
    level: 1,
    maxFiles: 20,
    maxSize: 5 * 1024 * 1024, // 5MB
    allowNodeModules: false,
    allowAdvancedJS: false,
    requiresVerification: false
  },
  'standard': {
    level: 2,
    maxFiles: 50,
    maxSize: 10 * 1024 * 1024, // 10MB
    allowNodeModules: true,
    allowedNodeModules: ALLOWED_NODE_MODULES.slice(0, 30),
    allowAdvancedJS: true,
    requiresVerification: false
  },
  'advanced': {
    level: 3,
    maxFiles: 100,
    maxSize: 25 * 1024 * 1024, // 25MB
    allowNodeModules: true,
    allowedNodeModules: ALLOWED_NODE_MODULES,
    allowAdvancedJS: true,
    requiresVerification: true,
    sandboxLevel: 'strict'
  }
};

export default async function handler(req, res) {
  // Start timing for performance monitoring
  const startTime = Date.now();
  
  // Enhanced CORS with stricter headers
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin) {
    console.warn(`Unauthorized origin attempt: ${origin}`);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Origin, X-Requested-With, Authorization');
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
      requestData.count = 1;
      requestData.resetTime = now + RATE_LIMIT_CONFIG.WINDOW_MS;
    } else {
      requestData.count++;
      
      if (requestData.count > RATE_LIMIT_CONFIG.MAX_REQUESTS) {
        requestData.violations++;
        
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

  // Size limit check (50MB for advanced packages)
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > 50 * 1024 * 1024) {
    return res.status(413).json({
      success: false,
      error: 'Request body too large. Maximum 50MB allowed for advanced packages.',
      code: 'PAYLOAD_TOO_LARGE'
    });
  }

  try {
    const { 
      name, 
      packJson, 
      files, 
      isPublic = true,
      packageType = 'basic',
      version = '1.0.0',
      isNewVersion = false,
      basePackId = null,
      userId = null,
      editToken = null,
      collaborators = []
    } = req.body;

    // Validate required fields
    if (!name || !packJson || !files) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: name, packJson, and files are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Validate package name
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

    // Validate package type
    if (!PACKAGE_TYPES[packageType]) {
      return res.status(400).json({
        success: false,
        error: `Invalid package type. Must be one of: ${Object.keys(PACKAGE_TYPES).join(', ')}`,
        code: 'INVALID_PACKAGE_TYPE'
      });
    }

    const packageConfig = PACKAGE_TYPES[packageType];

    // Validate packJson
    let packJsonObj;
    try {
      packJsonObj = JSON.parse(packJson);
      
      if (typeof packJsonObj !== 'object' || packJsonObj === null) {
        return res.status(400).json({
          success: false,
          error: 'packJson must be a valid JSON object',
          code: 'INVALID_PACK_JSON'
        });
      }
      
      // Validate packJson size
      const packJsonSize = JSON.stringify(packJsonObj).length;
      if (packJsonSize > 2 * 1024 * 1024) { // 2MB max for advanced packages
        return res.status(400).json({
          success: false,
          error: 'packJson too large. Maximum 2MB allowed.',
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

    // File count limit based on package type
    const fileCount = Object.keys(files).length;
    if (fileCount > packageConfig.maxFiles) {
      return res.status(400).json({ 
        success: false, 
        error: `Too many files. Maximum ${packageConfig.maxFiles} files allowed for ${packageType} packages.`,
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
    const processedFiles = {};
    const fileDependencies = new Set();
    
    for (const [filename, content] of Object.entries(files)) {
      // Validate filename
      const filenameValidation = validateFilename(filename, packageType);
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
      
      // Individual file size limit
      const maxFileSize = packageType === 'advanced' ? 10 * 1024 * 1024 : 2 * 1024 * 1024;
      if (fileSize > maxFileSize) {
        return res.status(400).json({ 
          success: false, 
          error: `File too large: ${filename}. Maximum ${maxFileSize / 1024 / 1024}MB per file.`,
          code: 'FILE_TOO_LARGE'
        });
      }

      // Check for empty files
      if (fileSize === 0 && !filename.endsWith('.json')) {
        return res.status(400).json({
          success: false,
          error: `File cannot be empty: ${filename}`,
          code: 'EMPTY_FILE'
        });
      }

      // File extension validation
      const ext = filename.split('.').pop().toLowerCase();
      const fileType = getFileType(ext);
      
      if (!fileType && (!ext || ext === filename)) {
        const essentialNoExt = ESSENTIAL_FILES.filter(f => !f.includes('.'));
        if (!essentialNoExt.includes(filename)) {
          return res.status(400).json({
            success: false,
            error: `Unsupported file extension: .${ext}`,
            code: 'UNSUPPORTED_EXTENSION'
          });
        }
      } else if (!fileType) {
        return res.status(400).json({
          success: false,
          error: `Unsupported file extension: .${ext}`,
          code: 'UNSUPPORTED_EXTENSION'
        });
      }

      // Content validation based on package type
      const contentValidation = validateFileContent(filename, content, fileType, packageType);
      if (!contentValidation.valid) {
        return res.status(400).json({
          success: false,
          error: `Invalid content in ${filename}: ${contentValidation.reason}`,
          code: 'INVALID_CONTENT'
        });
      }

      // Extract dependencies from package.json
      if (filename.toLowerCase() === 'package.json') {
        try {
          const pkgJson = JSON.parse(content);
          if (pkgJson.dependencies) {
            Object.keys(pkgJson.dependencies).forEach(dep => {
              if (dep.startsWith('@')) return; // Skip scoped packages
              fileDependencies.add(dep.toLowerCase());
            });
          }
        } catch (e) {
          // Ignore parsing errors, will be caught by validation
        }
      }

      // Store sanitized content
      processedFiles[filename] = content;
    }

    // Total package size limit
    if (totalSize > packageConfig.maxSize) {
      return res.status(400).json({ 
        success: false, 
        error: `Package too large. Total size: ${(totalSize / 1024 / 1024).toFixed(2)}MB. Maximum ${packageConfig.maxSize / 1024 / 1024}MB for ${packageType} packages.`,
        code: 'PACKAGE_TOO_LARGE'
      });
    }

    // Validate dependencies for advanced packages
    if (packageType === 'advanced' || packageType === 'standard') {
      for (const dep of fileDependencies) {
        const allowed = packageConfig.allowedNodeModules || ALLOWED_NODE_MODULES;
        if (!allowed.includes(dep) && !allowed.some(a => dep.startsWith(a + '/'))) {
          return res.status(400).json({
            success: false,
            error: `Dependency "${dep}" is not allowed for ${packageType} packages.`,
            code: 'DISALLOWED_DEPENDENCY',
            allowedModules: allowed
          });
        }
        
        // Check banned modules
        if (BANNED_NODE_MODULES.includes(dep)) {
          return res.status(400).json({
            success: false,
            error: `Dependency "${dep}" is banned for security reasons.`,
            code: 'BANNED_DEPENDENCY'
          });
        }
      }
    }

    // VERSIONING AND COLLABORATION LOGIC
    let versionNumber = sanitizeVersion(version);
    let parentPackId = null;
    let versionSequence = 1;
    
    if (isNewVersion && basePackId) {
      // Create new version of existing pack
      const { data: basePack, error: baseError } = await supabase
        .from('packs')
        .select('id, name, version, version_sequence, parent_pack_id, collaborators')
        .eq('id', basePackId)
        .single();
      
      if (baseError || !basePack) {
        return res.status(404).json({
          success: false,
          error: 'Base package not found',
          code: 'BASE_PACK_NOT_FOUND'
        });
      }
      
      // Verify edit permissions
      const canEdit = await verifyEditPermission(basePackId, userId, editToken, basePack.collaborators);
      if (!canEdit) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to edit this package',
          code: 'EDIT_PERMISSION_DENIED'
        });
      }
      
      parentPackId = basePack.parent_pack_id || basePack.id;
      
      // Get latest version sequence
      const { data: versions } = await supabase
        .from('packs')
        .select('version_sequence')
        .eq('parent_pack_id', parentPackId)
        .order('version_sequence', { ascending: false })
        .limit(1);
      
      versionSequence = versions && versions.length > 0 ? versions[0].version_sequence + 1 : 1;
    } else {
      // New package - check for existing name
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
      
      if (existingPack && existingPack.length > 0) {
        const existing = existingPack[0];
        const createdAt = new Date(existing.created_at).toLocaleDateString();
        
        return res.status(409).json({
          success: false,
          error: `Package name "${name}" is already taken. Package names must be unique.`,
          code: 'PACKAGE_NAME_EXISTS',
          existingPackageId: existing.id,
          existingPackageCreated: createdAt,
          suggestion: `Use "isNewVersion: true" and "basePackId: "${existing.id}" to create a new version`
        });
      }
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
      return res.status(500).json({
        success: false,
        error: 'Internal server error: URL ID collision',
        code: 'URL_ID_COLLISION'
      });
    }

    // Generate URLs
    const cdnUrl = `https://packcdn.firefly-worker.workers.dev/cdn/${urlId}`;
    const workerUrl = `https://packcdn.firefly-worker.workers.dev/pack/${urlId}`;
    
    // Generate encryption key for private packages
    const encryptedKey = !isPublic ? generateSecureEncryptionKey() : null;

    // Generate checksum
    const packageChecksum = generateChecksum(JSON.stringify(processedFiles));

    // Prepare collaborators array
    const sanitizedCollaborators = Array.isArray(collaborators) 
      ? collaborators.filter(c => c && typeof c === 'string' && c.length > 0).slice(0, 10)
      : [];

    // Add current user as collaborator if not already
    if (userId && !sanitizedCollaborators.includes(userId)) {
      sanitizedCollaborators.unshift(userId);
    }

    // Save to Supabase
    const now = new Date().toISOString();
    const packData = {
      url_id: urlId,
      name,
      pack_json: packJson,
      files: processedFiles,
      cdn_url: cdnUrl,
      worker_url: workerUrl,
      encrypted_key: encryptedKey,
      is_public: isPublic,
      package_type: packageType,
      version: versionNumber,
      version_sequence: versionSequence,
      parent_pack_id: parentPackId,
      checksum: packageChecksum,
      file_count: fileCount,
      total_size: totalSize,
      dependencies: Array.from(fileDependencies),
      collaborators: sanitizedCollaborators,
      created_at: now,
      updated_at: now,
      views: 0,
      downloads: 0,
      publish_ip: clientIp,
      last_accessed: now,
      publisher_id: userId,
      sandbox_level: packageConfig.sandboxLevel || 'basic',
      requires_verification: packageConfig.requiresVerification || false,
      verification_status: packageConfig.requiresVerification ? 'pending' : 'approved'
    };

    const { data, error } = await supabase
      .from('packs')
      .insert([packData])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      
      if (error.code === '23505') {
        return res.status(409).json({ 
          success: false, 
          error: 'Package with this name already exists',
          code: 'DUPLICATE_PACKAGE'
        });
      }
      
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

    // Create version history entry
    if (isNewVersion && basePackId) {
      try {
        await supabase
          .from('pack_versions')
          .insert([{
            pack_id: data.id,
            parent_pack_id: parentPackId,
            version: versionNumber,
            version_sequence: versionSequence,
            changes: `New version created`,
            publisher_id: userId,
            created_at: now
          }]);
      } catch (versionError) {
        console.warn('Version history logging failed:', versionError);
      }
    }

    // Log successful publish
    const processingTime = Date.now() - startTime;
    console.log(`Package published successfully:`, {
      name,
      urlId,
      packageType,
      version: versionNumber,
      versionSequence,
      fileCount,
      totalSize: `${(totalSize / 1024).toFixed(2)}KB`,
      processingTime: `${processingTime}ms`,
      clientIp,
      isNewVersion,
      parentPackId
    });

    // Audit log
    try {
      await supabase
        .from('publish_audit_log')
        .insert([{
          pack_id: data.id,
          pack_name: name,
          client_ip: clientIp,
          package_type: packageType,
          version: versionNumber,
          file_count: fileCount,
          total_size: totalSize,
          is_public: isPublic,
          is_new_version: isNewVersion,
          parent_pack_id: parentPackId,
          created_at: now
        }]);
    } catch (auditError) {
      console.warn('Audit logging failed:', auditError);
    }

    // Return success response
    res.status(201).json({
      success: true,
      packId: data.id,
      urlId: urlId,
      cdnUrl,
      workerUrl,
      installCommand: `pack install ${name}@${versionNumber} ${cdnUrl}`,
      encryptedKey,
      isNewVersion,
      parentPackId,
      version: versionNumber,
      versionSequence,
      metadata: {
        name,
        version: versionNumber,
        packageType,
        fileCount,
        totalSize,
        isPublic,
        collaborators: sanitizedCollaborators,
        createdAt: now,
        checksum: packageChecksum,
        dependencies: Array.from(fileDependencies)
      },
      links: {
        cdn: cdnUrl,
        info: workerUrl,
        download: `${cdnUrl}/index.js`,
        api: `/api/get-pack?id=${urlId}`,
        versions: `/api/pack-versions?id=${parentPackId || data.id}`
      }
    });

  } catch (error) {
    console.error('Publish error:', {
      message: error.message,
      stack: error.stack,
      clientIp,
      timestamp: new Date().toISOString(),
      processingTime: `${Date.now() - startTime}ms`
    });
    
    res.status(500).json({ 
      success: false, 
      error: 'An unexpected error occurred. Please try again later.',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
}

// HELPER FUNCTIONS

async function verifyEditPermission(packId, userId, editToken, collaborators = []) {
  // Public editing (anyone can create new versions)
  if (!userId) {
    return true; // Allow anonymous version creation
  }
  
  // Check if user is in collaborators list
  if (collaborators.includes(userId)) {
    return true;
  }
  
  // Check if user is the original publisher
  const { data: pack } = await supabase
    .from('packs')
    .select('publisher_id')
    .eq('id', packId)
    .single();
  
  if (pack && pack.publisher_id === userId) {
    return true;
  }
  
  // Check edit token (for shared editing)
  if (editToken) {
    const { data: tokenData } = await supabase
      .from('edit_tokens')
      .select('pack_id, expires_at')
      .eq('token', editToken)
      .eq('pack_id', packId)
      .single();
    
    if (tokenData && new Date(tokenData.expires_at) > new Date()) {
      return true;
    }
  }
  
  return false;
}

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
  
  if (!/^[a-z]/.test(name)) {
    return { valid: false, reason: 'Package name must start with a lowercase letter' };
  }
  
  if (!/^[a-z0-9-_]+$/.test(name)) {
    return { valid: false, reason: 'Package name can only contain lowercase letters, numbers, hyphens, and underscores' };
  }
  
  if (/[-_]$/.test(name)) {
    return { valid: false, reason: 'Package name cannot end with a hyphen or underscore' };
  }
  
  if (/[-_]{2,}/.test(name)) {
    return { valid: false, reason: 'Package name cannot contain consecutive hyphens or underscores' };
  }
  
  const offensivePatterns = [
    /admin/i, /root/i, /system/i, /config/i,
    /password/i, /token/i, /secret/i, /private/i
  ];
  
  if (offensivePatterns.some(pattern => pattern.test(name))) {
    return { valid: false, reason: 'Package name contains restricted patterns' };
  }
  
  return { valid: true };
}

function validateFilename(filename, packageType) {
  if (typeof filename !== 'string') {
    return { valid: false, reason: 'Filename must be a string' };
  }
  
  if (filename.length === 0) {
    return { valid: false, reason: 'Filename cannot be empty' };
  }
  
  if (filename.length > 255) {
    return { valid: false, reason: 'Filename cannot exceed 255 characters' };
  }
  
  if (!/^[a-zA-Z0-9._\-]+$/.test(filename)) {
    return { valid: false, reason: 'Filename can only contain letters, numbers, dots, hyphens, and underscores' };
  }
  
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return { valid: false, reason: 'Filename cannot contain directory traversal characters' };
  }
  
  const allowedHiddenFiles = [
    '.gitignore', '.env', '.npmrc', '.prettierrc', '.eslintrc',
    '.babelrc', '.dockerignore', '.gitattributes', '.editorconfig'
  ];
  
  if (filename.startsWith('.') && !allowedHiddenFiles.some(allowed => 
      filename === allowed || filename.startsWith(allowed + '/'))) {
    return { valid: false, reason: 'Hidden files are only allowed for common configuration files' };
  }
  
  const essentialFileLower = filename.toLowerCase();
  if (ESSENTIAL_FILES.some(essential => essentialFileLower === essential.toLowerCase())) {
    return { valid: true };
  }
  
  const reservedDirectories = [
    'node_modules', 'vendor', 'lib', 'bin', 'dist', 'build',
    'public', 'src', 'test', 'tests', 'docs', 'examples'
  ];
  
  if (reservedDirectories.includes(filename.toLowerCase())) {
    return { valid: false, reason: 'Filename is reserved for system use' };
  }
  
  const ext = filename.split('.').pop().toLowerCase();
  if (!ext || ext === filename) {
    const allowedNoExt = /^[A-Z][A-Z0-9_]*(\.[A-Z0-9]+)?$/;
    if (allowedNoExt.test(filename)) {
      return { valid: true };
    }
    return { valid: false, reason: 'Files without extensions must follow common naming conventions' };
  }
  
  // Advanced packages can have more file types
  if (packageType === 'basic' && ['ts', 'tsx', 'scss', 'sass'].includes(ext)) {
    return { valid: false, reason: `File extension .${ext} requires standard or advanced package type` };
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

function validateFileContent(filename, content, fileType, packageType) {
  if (/\x00/.test(content)) {
    return { valid: false, reason: 'File contains null bytes' };
  }
  
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.length > 10000) {
      return { valid: false, reason: 'File contains excessively long lines' };
    }
  }
  
  const filenameLower = filename.toLowerCase();
  
  if (ESSENTIAL_FILES.some(essential => filenameLower === essential.toLowerCase())) {
    if (filenameLower === 'package.json' || filename.endsWith('.json')) {
      try {
        JSON.parse(content);
        return { valid: true };
      } catch (e) {
        return { valid: false, reason: 'Invalid JSON format in package.json' };
      }
    }
    return { valid: true };
  }
  
  switch (fileType) {
    case 'js':
      return validateJavaScript(content, packageType);
    case 'json':
      return validateJSON(content);
    default:
      return { valid: true };
  }
}

function validateJavaScript(content, packageType) {
  const dangerousPatterns = [
    /\beval\s*\(/i,
    /\bFunction\s*\(/i,
    /new\s+Function\s*\(/i,
    /\bsetTimeout\s*\([^)]*\)/i,
    /\bsetInterval\s*\([^)]*\)/i,
    /\bsetImmediate\s*\([^)]*\)/i
  ];
  
  // Allow more patterns for advanced packages
  if (packageType === 'basic') {
    dangerousPatterns.push(
      /\brequire\s*\([^)]*\)/i,
      /\bprocess\s*\./i,
      /\bfs\s*\./i,
      /\bfetch\s*\([^)]*\)/i,
      /\bXMLHttpRequest/i
    );
  }
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      const reason = packageType === 'basic' 
        ? 'Basic packages cannot use dynamic imports or I/O operations'
        : 'JavaScript contains potentially dangerous patterns';
      return { valid: false, reason };
    }
  }
  
  const avgLineLength = content.length / (content.split('\n').length || 1);
  if (avgLineLength > 1000) {
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

function generateSecureUrlId() {
  return crypto.randomBytes(12).toString('hex') + 
         Date.now().toString(36) +
         crypto.randomBytes(4).toString('hex');
}

function generateSecureEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

function sanitizeVersion(version) {
  if (typeof version !== 'string') return '1.0.0';
  
  // Remove everything except numbers, dots, and prerelease identifiers
  const sanitized = version.replace(/[^0-9.a-zA-Z-+]/g, '');
  
  if (!sanitized.includes('.')) {
    return sanitized + '.0.0';
  }
  
  const parts = sanitized.split('.').filter(part => part !== '');
  if (parts.length === 0) return '1.0.0';
  
  const numericParts = parts.map(part => {
    const numMatch = part.match(/^(\d+)/);
    return numMatch ? numMatch[1] : '0';
  });
  
  while (numericParts.length < 3) {
    numericParts.push('0');
  }
  
  return numericParts.slice(0, 5).join('.');
}

function generateChecksum(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Cleanup rate limiting store
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitStore.entries()) {
    if (now > data.resetTime + 60 * 60 * 1000 && data.bannedUntil < now) {
      rateLimitStore.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// Export for testing
if (process.env.NODE_ENV === 'test') {
  module.exports = {
    validatePackageName,
    validateFilename,
    validateFileContent,
    sanitizeVersion,
    generateSecureUrlId,
    PACKAGE_TYPES,
    ALLOWED_NODE_MODULES,
    BANNED_NODE_MODULES
  };
}
