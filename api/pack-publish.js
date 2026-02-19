// /api/pack-publish.js
// Self‑contained API endpoint for publishing packs in PackLang or HSX.
// Uses same Supabase tables as your existing JavaScript/WASM packs – no schema changes.
// ---------------------------------------------------------------------------------------

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ============================================================================
// 1. SUPABASE CLIENT (uses same env vars as publish.js)
// ============================================================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// 2. RATE LIMITING (copied from your publish.js)
// ============================================================================
const rateLimitStore = new Map();
const RATE_LIMIT_CONFIG = {
  WINDOW_MS: 60 * 1000,
  MAX_REQUESTS: 10,
  BAN_WINDOW_MS: 15 * 60 * 1000,
  BAN_THRESHOLD: 20
};

// ============================================================================
// 3. ALLOWED ORIGINS (copied from your publish.js)
// ============================================================================
const ALLOWED_ORIGINS = [
  'https://pack-cdn.vercel.app',
  'https://pack-dash.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173'
];

// ============================================================================
// 4. RESERVED NAMES (copied from your publish.js)
// ============================================================================
const RESERVED_NAMES = [
  'pack', 'npm', 'node', 'js', 'python', 'wasm',
  'system', 'admin', 'root', 'config', 'setup',
  'install', 'update', 'remove', 'delete', 'create'
];

// ============================================================================
// 5. HELPER FUNCTIONS (all defined inline – no external imports)
// ============================================================================

// 5.1 Validate pack name (identical to your publish.js)
function validatePackName(name) {
  if (typeof name !== 'string') {
    return { valid: false, reason: 'Pack name must be a string' };
  }
  if (name.length < 2) {
    return { valid: false, reason: 'Pack name must be at least 2 characters' };
  }
  if (name.length > 50) {
    return { valid: false, reason: 'Pack name cannot exceed 50 characters' };
  }
  if (!/^[a-z]/.test(name)) {
    return { valid: false, reason: 'Pack name must start with a lowercase letter' };
  }
  if (!/^[a-z0-9-_]+$/.test(name)) {
    return { valid: false, reason: 'Pack name can only contain lowercase letters, numbers, hyphens, and underscores' };
  }
  if (/[-_]$/.test(name)) {
    return { valid: false, reason: 'Pack name cannot end with a hyphen or underscore' };
  }
  if (/[-_]{2,}/.test(name)) {
    return { valid: false, reason: 'Pack name cannot contain consecutive hyphens or underscores' };
  }
  return { valid: true };
}

// 5.2 Generate secure URL ID (copied from publish.js)
function generateSecureUrlId() {
  return crypto.randomBytes(12).toString('hex') +
         Date.now().toString(36) +
         crypto.randomBytes(4).toString('hex');
}

// 5.3 Generate checksum (copied from publish.js)
function generateChecksum(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// 5.4 Get next version number (copied from publish.js)
async function getNextVersionNumber(packId) {
  try {
    const { data: versions } = await supabase
      .from('pack_versions')
      .select('version_number')
      .eq('pack_id', packId)
      .order('version_number', { ascending: false })
      .limit(1);
    return versions && versions.length > 0 ? versions[0].version_number + 1 : 1;
  } catch (error) {
    console.error('Version number check failed:', error);
    return 1;
  }
}

// 5.5 Check edit permissions (simplified version of your canUserEditPack)
async function canUserEditPack(packId, userId, editToken, req) {
  if (editToken) {
    const { data: token, error } = await supabase
      .from('edit_tokens')
      .select('*')
      .eq('token', editToken)
      .eq('pack_id', packId)
      .single();
    if (!error && token) {
      const now = new Date();
      const expiresAt = new Date(token.expires_at);
      if (expiresAt > now && (token.max_uses === 0 || token.use_count < token.max_uses)) {
        await supabase
          .from('edit_tokens')
          .update({ use_count: token.use_count + 1, updated_at: new Date().toISOString() })
          .eq('id', token.id);
        return true;
      }
    }
  }

  if (userId) {
    const { data: pack } = await supabase
      .from('packs')
      .select('publisher_id')
      .eq('id', packId)
      .single();
    if (pack && pack.publisher_id === userId) return true;

    const { data: collaborator } = await supabase
      .from('pack_collaborators')
      .select('*')
      .eq('pack_id', packId)
      .eq('user_id', userId)
      .single();
    if (collaborator) return true;
  }

  return false;
}

// 5.6 Generate encryption key (unused but kept for consistency)
function generateSecureEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

// ============================================================================
// 6. PACKLANG LEXER, PARSER, AND VALIDATION
// ============================================================================

// --------------------------------- Lexer ---------------------------------
const TokenType = {
  KEYWORD: 'KEYWORD',
  IDENTIFIER: 'IDENTIFIER',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  PUNCTUATION: 'PUNCTUATION',
  OPERATOR: 'OPERATOR',
  EOF: 'EOF'
};

const KEYWORDS = new Set([
  'pack', 'version', 'import', 'fn', 'task', 'wasm', 'export',
  'return', 'if', 'else', 'while', 'for', 'in', 'true', 'false',
  'i32', 'i64', 'f32', 'f64', 'string', 'bool', 'void'
]);

function tokenize(source) {
  const tokens = [];
  let pos = 0;
  const length = source.length;

  while (pos < length) {
    // Skip whitespace
    if (/\s/.test(source[pos])) {
      pos++;
      continue;
    }

    // Skip comments (line comments starting with //)
    if (source[pos] === '/' && pos + 1 < length && source[pos + 1] === '/') {
      while (pos < length && source[pos] !== '\n') pos++;
      continue;
    }

    // Strings (double quoted)
    if (source[pos] === '"') {
      let str = '';
      pos++; // skip opening quote
      while (pos < length && source[pos] !== '"') {
        if (source[pos] === '\\' && pos + 1 < length) {
          pos++;
          str += source[pos]; // simplified escape handling
        } else {
          str += source[pos];
        }
        pos++;
      }
      if (pos >= length) throw new Error('Unterminated string');
      pos++; // skip closing quote
      tokens.push({ type: TokenType.STRING, value: str });
      continue;
    }

    // Numbers (integer)
    if (/[0-9]/.test(source[pos])) {
      let num = '';
      while (pos < length && /[0-9]/.test(source[pos])) {
        num += source[pos];
        pos++;
      }
      tokens.push({ type: TokenType.NUMBER, value: parseInt(num, 10) });
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(source[pos])) {
      let ident = '';
      while (pos < length && /[a-zA-Z0-9_]/.test(source[pos])) {
        ident += source[pos];
        pos++;
      }
      const type = KEYWORDS.has(ident) ? TokenType.KEYWORD : TokenType.IDENTIFIER;
      tokens.push({ type, value: ident });
      continue;
    }

    // Operators and punctuation
    const char = source[pos];
    if ('+-*/=<>!&|'.includes(char)) {
      // simple single-char operators, could be extended
      tokens.push({ type: TokenType.OPERATOR, value: char });
      pos++;
      continue;
    }
    if ('{}()[]:,;.->'.includes(char)) {
      tokens.push({ type: TokenType.PUNCTUATION, value: char });
      pos++;
      continue;
    }

    throw new Error(`Unexpected character '${char}' at position ${pos}`);
  }

  tokens.push({ type: TokenType.EOF, value: null });
  return tokens;
}

// --------------------------------- Parser ---------------------------------
class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() {
    return this.tokens[this.pos];
  }

  consume(type, value = null) {
    const token = this.peek();
    if (token.type !== type || (value !== null && token.value !== value)) {
      throw new Error(`Expected ${type} ${value ? value : ''} but got ${token.type} ${token.value}`);
    }
    this.pos++;
    return token;
  }

  match(type, value = null) {
    const token = this.peek();
    if (token.type === type && (value === null || token.value === value)) {
      this.pos++;
      return token;
    }
    return null;
  }

  // Program = Header Import* (FunctionDecl / TaskDecl / WasmDecl)* Export?
  parseProgram() {
    const header = this.parseHeader();
    const imports = [];
    while (this.match(TokenType.KEYWORD, 'import')) {
      imports.push(this.parseImport());
    }
    const declarations = [];
    while (true) {
      if (this.match(TokenType.KEYWORD, 'fn')) {
        declarations.push(this.parseFunction());
      } else if (this.match(TokenType.KEYWORD, 'task')) {
        declarations.push(this.parseTask());
      } else if (this.match(TokenType.KEYWORD, 'wasm')) {
        declarations.push(this.parseWasm());
      } else {
        break;
      }
    }
    let exportDecl = null;
    if (this.match(TokenType.KEYWORD, 'export')) {
      exportDecl = this.parseExport();
    }
    this.consume(TokenType.EOF);
    return {
      type: 'Program',
      header,
      imports,
      declarations,
      export: exportDecl
    };
  }

  // Header: 'pack' STRING 'version' STRING
  parseHeader() {
    this.consume(TokenType.KEYWORD, 'pack');
    const nameToken = this.consume(TokenType.STRING);
    this.consume(TokenType.KEYWORD, 'version');
    const versionToken = this.consume(TokenType.STRING);
    return {
      type: 'Header',
      name: nameToken.value,
      version: versionToken.value
    };
  }

  // Import: 'import' STRING
  parseImport() {
    // 'import' already consumed by caller
    const moduleToken = this.consume(TokenType.STRING);
    return {
      type: 'Import',
      module: moduleToken.value
    };
  }

  // FunctionDecl: 'fn' IDENTIFIER '(' ParamList? ')' ('->' Type)? Block
  parseFunction() {
    const nameToken = this.consume(TokenType.IDENTIFIER);
    this.consume(TokenType.PUNCTUATION, '(');
    const params = [];
    if (!this.match(TokenType.PUNCTUATION, ')')) {
      do {
        const paramName = this.consume(TokenType.IDENTIFIER).value;
        let paramType = null;
        if (this.match(TokenType.PUNCTUATION, ':')) {
          paramType = this.consume(TokenType.IDENTIFIER).value;
        }
        params.push({ name: paramName, type: paramType });
      } while (this.match(TokenType.PUNCTUATION, ','));
      this.consume(TokenType.PUNCTUATION, ')');
    } else {
      this.consume(TokenType.PUNCTUATION, ')');
    }
    let returnType = null;
    if (this.match(TokenType.OPERATOR, '-') && this.match(TokenType.PUNCTUATION, '>')) {
      // '->' was consumed as two tokens, but we already matched them
      returnType = this.consume(TokenType.IDENTIFIER).value;
    }
    const body = this.parseBlock();
    return {
      type: 'Function',
      name: nameToken.value,
      params,
      returnType,
      body
    };
  }

  // TaskDecl: 'task' IDENTIFIER Block
  parseTask() {
    const nameToken = this.consume(TokenType.IDENTIFIER);
    const body = this.parseBlock();
    return {
      type: 'Task',
      name: nameToken.value,
      body
    };
  }

  // WasmDecl: 'wasm' IDENTIFIER '{' .*? '}'  (simplified: we capture raw text until matching '}')
  parseWasm() {
    const nameToken = this.consume(TokenType.IDENTIFIER);
    this.consume(TokenType.PUNCTUATION, '{');
    let depth = 1;
    let wasmSource = '';
    while (depth > 0) {
      const token = this.peek();
      if (token.type === TokenType.PUNCTUATION) {
        if (token.value === '{') depth++;
        else if (token.value === '}') depth--;
      }
      if (depth === 0) break;
      wasmSource += token.value; // crude concatenation
      this.pos++;
    }
    this.consume(TokenType.PUNCTUATION, '}');
    return {
      type: 'Wasm',
      name: nameToken.value,
      source: wasmSource.trim()
    };
  }

  // Block: '{' Statement* '}'
  parseBlock() {
    this.consume(TokenType.PUNCTUATION, '{');
    const statements = [];
    while (!this.match(TokenType.PUNCTUATION, '}')) {
      statements.push(this.parseStatement());
    }
    return {
      type: 'Block',
      statements
    };
  }

  // Statement: ReturnStatement / ExpressionStatement / IfStatement / WhileStatement / ...
  // For simplicity, we only implement Return and basic expression statements.
  parseStatement() {
    if (this.match(TokenType.KEYWORD, 'return')) {
      const expr = this.parseExpression();
      this.consume(TokenType.PUNCTUATION, ';');
      return { type: 'Return', expression: expr };
    }
    // Otherwise parse an expression followed by semicolon
    const expr = this.parseExpression();
    this.consume(TokenType.PUNCTUATION, ';');
    return { type: 'ExpressionStatement', expression: expr };
  }

  // Expression: Assignment / Binary / Call / Primary
  parseExpression() {
    return this.parseBinary(0);
  }

  // Precedence climbing for binary operators
  parseBinary(minPrec) {
    let left = this.parsePrimary();
    while (true) {
      const token = this.peek();
      if (token.type !== TokenType.OPERATOR) break;
      const op = token.value;
      const prec = this.getPrecedence(op);
      if (prec < minPrec) break;
      this.pos++;
      const right = this.parseBinary(prec + 1);
      left = { type: 'Binary', operator: op, left, right };
    }
    return left;
  }

  getPrecedence(op) {
    switch (op) {
      case '*': case '/': return 3;
      case '+': case '-': return 2;
      case '<': case '>': case '==': case '!=': return 1;
      default: return 0;
    }
  }

  // Primary: Literal / Identifier / '(' Expression ')' / Call
  parsePrimary() {
    const token = this.peek();
    if (token.type === TokenType.NUMBER) {
      this.pos++;
      return { type: 'NumberLiteral', value: token.value };
    }
    if (token.type === TokenType.STRING) {
      this.pos++;
      return { type: 'StringLiteral', value: token.value };
    }
    if (token.type === TokenType.IDENTIFIER) {
      const name = token.value;
      this.pos++;
      // Check for function call
      if (this.match(TokenType.PUNCTUATION, '(')) {
        const args = [];
        if (!this.match(TokenType.PUNCTUATION, ')')) {
          do {
            args.push(this.parseExpression());
          } while (this.match(TokenType.PUNCTUATION, ','));
          this.consume(TokenType.PUNCTUATION, ')');
        } else {
          // empty arguments
        }
        return { type: 'Call', callee: name, arguments: args };
      }
      return { type: 'Identifier', name };
    }
    if (token.type === TokenType.PUNCTUATION && token.value === '(') {
      this.pos++;
      const expr = this.parseExpression();
      this.consume(TokenType.PUNCTUATION, ')');
      return expr;
    }
    throw new Error(`Unexpected token in expression: ${token.type} ${token.value}`);
  }

  // ExportDecl: 'export' IDENTIFIER (',' IDENTIFIER)*
  parseExport() {
    const exports = [];
    do {
      const id = this.consume(TokenType.IDENTIFIER).value;
      exports.push(id);
    } while (this.match(TokenType.PUNCTUATION, ','));
    // No semicolon required
    return {
      type: 'Export',
      exports
    };
  }
}

// --------------------------------- Validation ---------------------------------
function validatePackLang(source) {
  try {
    const tokens = tokenize(source);
    const parser = new Parser(tokens);
    const ast = parser.parseProgram();

    // Additional semantic checks
    const errors = [];

    // Check that pack name in header matches the name field from request (we'll do that in main handler)
    // For now, just ensure header exists
    if (!ast.header) {
      errors.push('Missing pack header');
    }

    // Check for duplicate declaration names
    const names = new Set();
    for (const decl of ast.declarations) {
      if (names.has(decl.name)) {
        errors.push(`Duplicate declaration name: ${decl.name}`);
      }
      names.add(decl.name);
    }

    // Check that all exported names exist
    if (ast.export) {
      for (const exp of ast.export.exports) {
        if (!names.has(exp)) {
          errors.push(`Exported name "${exp}" is not declared`);
        }
      }
    }

    if (errors.length > 0) {
      return { valid: false, error: errors.join('; ') };
    }

    return { valid: true, ast };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

// ============================================================================
// 7. HSX VALIDATION (minimal – just check that source is not empty)
// ============================================================================
function validateHSX(source) {
  if (!source || source.trim().length === 0) {
    return { valid: false, error: 'HSX source cannot be empty' };
  }
  return { valid: true };
}

// ============================================================================
// 8. MAIN HANDLER
// ============================================================================
export default async function handler(req, res) {
  const startTime = Date.now();

  // ----- CORS (same as publish.js) -----
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Origin, X-Requested-With, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only POST allowed for publishing
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  // ----- Rate limiting (same logic as publish.js) -----
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
        error: 'IP temporarily banned',
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

  // ----- Parse request body -----
  const {
    name,
    source,           // source code
    language = 'packlang', // 'packlang' or 'hsx'
    metadata = {},
    isPublic = true,
    userId = null,
    editToken = null,
    collaborators = []
  } = req.body;

  if (!name || !source) {
    return res.status(400).json({ success: false, error: 'name and source are required' });
  }

  // Validate pack name
  const nameValidation = validatePackName(name);
  if (!nameValidation.valid) {
    return res.status(400).json({ success: false, error: nameValidation.reason });
  }

  // Validate source according to language
  let validationResult;
  if (language === 'packlang') {
    validationResult = validatePackLang(source);
  } else if (language === 'hsx') {
    validationResult = validateHSX(source);
  } else {
    return res.status(400).json({ success: false, error: `Unsupported language: ${language}` });
  }

  if (!validationResult.valid) {
    return res.status(400).json({
      success: false,
      error: `Invalid ${language} source`,
      details: validationResult.error
    });
  }

  // Construct pack metadata (pack_json)
  const version = metadata.version || '1.0.0';
  const description = metadata.description || `A ${language} pack: ${name}`;
  const packJson = {
    name,
    version,
    description,
    language,
    ...metadata
  };

  // Prepare files object – store source under main.{pl,hsx}
  const filename = language === 'packlang' ? 'main.pl' : 'main.hsx';
  const files = {
    [filename]: source,
    ...(metadata.files || {})
  };

  // Determine pack type – we'll use language as pack_type
  const packType = language; // 'packlang' or 'hsx'

  // Check for existing pack (versioning logic similar to publish.js)
  let isVersionOfId = null;
  if (metadata.isNewVersion && metadata.basePackId) {
    const canEdit = await canUserEditPack(metadata.basePackId, userId, editToken, req);
    if (!canEdit) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    isVersionOfId = metadata.basePackId;
  } else {
    // Prevent duplicate original packs
    const { data: existing } = await supabase
      .from('packs')
      .select('id')
      .eq('name', name)
      .is('is_version_of', null)
      .maybeSingle();
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Pack name already exists. Use versioning to publish a new version.',
        existingPackId: existing.id
      });
    }
  }

  // Generate IDs and URLs
  const urlId = generateSecureUrlId();
  const cdnUrl = `https://packcdn.firefly-worker.workers.dev/cdn/${urlId}`;
  const workerUrl = `https://packcdn.firefly-worker.workers.dev/pack/${urlId}`;

  const now = new Date().toISOString();
  const packData = {
    url_id: urlId,
    name,
    pack_json: JSON.stringify(packJson),
    files: files,
    cdn_url: cdnUrl,
    worker_url: workerUrl,
    encrypted_key: null,
    is_public: isPublic,
    version,
    pack_type: packType,
    created_at: now,
    updated_at: now,
    views: 0,
    downloads: 0,
    publish_ip: clientIp,
    last_accessed: now,
    publisher_id: userId,
    is_version_of: isVersionOfId
  };

  // Insert into database
  const { data: pack, error: packError } = await supabase
    .from('packs')
    .insert([packData])
    .select()
    .single();

  if (packError) {
    console.error('Supabase insert error:', packError);
    return res.status(500).json({ success: false, error: 'Database error' });
  }

  // Create version record
  const versionNumber = await getNextVersionNumber(pack.id);
  await supabase.from('pack_versions').insert([{
    pack_id: pack.id,
    version,
    version_number: versionNumber,
    pack_json: JSON.stringify(packJson),
    files: files,
    checksum: generateChecksum(JSON.stringify(files)),
    publisher_id: userId,
    created_at: now,
    updated_at: now
  }]);

  // Generate edit token (if anonymous)
  let generatedToken = null;
  if (!userId) {
    try {
      const token = crypto.randomBytes(32).toString('hex');
      generatedToken = token;
      await supabase.from('edit_tokens').insert([{
        pack_id: pack.id,
        token,
        created_by: 'anonymous',
        creator_ip: clientIp,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        max_uses: 50,
        use_count: 0,
        created_at: now,
        updated_at: now
      }]);
    } catch (tokenError) {
      console.warn('Edit token generation failed:', tokenError);
    }
  }

  // Return success
  const processingTime = Date.now() - startTime;
  res.status(201).json({
    success: true,
    packId: pack.id,
    urlId,
    cdnUrl,
    workerUrl,
    editToken: generatedToken,
    version,
    language,
    metadata: {
      name,
      version,
      packType,
      fileCount: Object.keys(files).length,
      isPublic,
      createdAt: now
    },
    links: {
      cdn: cdnUrl,
      info: workerUrl,
      raw: `${cdnUrl}/${filename}`,
      versions: `/api/pack-versions?id=${pack.id}`,
      edit: generatedToken ? `/api/edit-pack?id=${pack.id}&token=${generatedToken}` : `/api/edit-pack?id=${pack.id}`
    },
    processingTime: `${processingTime}ms`
  });

  // Clean up rate limit store periodically (optional, same as publish.js)
  setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of rateLimitStore.entries()) {
      if (now > data.resetTime + 60 * 60 * 1000 && data.bannedUntil < now) {
        rateLimitStore.delete(ip);
      }
    }
  }, 5 * 60 * 1000);
}
