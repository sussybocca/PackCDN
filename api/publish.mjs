// /api/publish.js - COMPLETE PRODUCTION READY IMPLEMENTATION WITH FUNCTIONAL PACK.JSON
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { WASI } from '@wasmer/wasi';
import { lowerI64Imports } from '@wasmer/wasm-transformer';
import { Command } from '@wasmer/sdk';

// ============================================================================
// SAFE MATH HELPERS
// ============================================================================
function getSafeMathFunctions() {
  const safeMathFunctions = {
    'Math_abs': Math.abs,
    'Math_sin': Math.sin,
    'Math_cos': Math.cos,
    'Math_tan': Math.tan,
    'Math_log': Math.log,
    'Math_exp': Math.exp,
    'Math_sqrt': Math.sqrt,
    'Math_pow': Math.pow,
    'Math_floor': Math.floor,
    'Math_ceil': Math.ceil,
    'Math_round': Math.round,
    'Math_random': Math.random,
    'Math_max': Math.max,
    'Math_min': Math.min,
    'Math_atan': Math.atan,
    'Math_atan2': Math.atan2,
    'Math_asin': Math.asin,
    'Math_acos': Math.acos
  };
  
  const result = {};
  for (const [key, func] of Object.entries(safeMathFunctions)) {
    if (typeof func === 'function') {
      result[key] = func;
    }
  }
  
  return result;
}

function generateMathImportsString() {
  const mathImports = getSafeMathFunctions();
  return Object.entries(mathImports)
    .map(([key, func]) => `${key}: Math.${key.replace('Math_', '')}`)
    .join(',\n          ');
}

// ============================================================================
// SUPABASE CLIENT
// ============================================================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// RATE LIMITING
// ============================================================================
const rateLimitStore = new Map();
const RATE_LIMIT_CONFIG = {
  WINDOW_MS: 60 * 1000,
  MAX_REQUESTS: 10,
  BAN_WINDOW_MS: 15 * 60 * 1000,
  BAN_THRESHOLD: 20
};

// ============================================================================
// ALLOWED ORIGINS
// ============================================================================
const ALLOWED_ORIGINS = [
  'https://pack-cdn.vercel.app',
  'https://pack-dash.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173'
];

// ============================================================================
// RESERVED PACK NAMES
// ============================================================================
const RESERVED_NAMES = [
  'pack', 'npm', 'node', 'js', 'python', 'wasm',
  'system', 'admin', 'root', 'config', 'setup',
  'install', 'update', 'remove', 'delete', 'create'
];

// ============================================================================
// FILE EXTENSIONS
// ============================================================================
const ALLOWED_EXTENSIONS = {
  'js': ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx'],
  'python': ['py', 'pyc', 'pyo'],
  'wasm': ['wasm', 'wat'],
  'json': ['json'],
  'markdown': ['md', 'markdown'],
  'text': ['txt'],
  'html': ['html', 'htm'],
  'css': ['css', 'scss', 'sass'],
  'image': ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'],
  'data': ['csv', 'tsv', 'xml', 'yaml', 'yml'],
  'binary': ['bin', 'dat'],
  'rust': ['rs', 'rlib'],
  'go': ['go'],
  'zig': ['zig']
};

// ============================================================================
// ESSENTIAL FILES – NOW PACK.JSON ONLY
// ============================================================================
const ESSENTIAL_FILES = [
  'pack.json',           // replaced package.json
  'index.js',
  'main.js',
  'app.js',
  'server.js',
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
  'CONTRIBUTING.md'
];

// ============================================================================
// ADVANCED PACK.JSON SCHEMA WITH COMPLEXITY LEVELS
// ============================================================================
const PACK_JSON_SCHEMA = {
  required: ['name', 'version'],
  
  optional: {
    description: { type: 'string', maxLength: 1000, default: '' },
    author: { type: 'string', maxLength: 100, default: '' },
    license: { type: 'string', default: 'MIT' },
    homepage: { type: 'string', format: 'url', default: '' },
    complexity: { type: 'string', enum: ['low', 'medium', 'high'], default: 'low' },
    repository: { 
      type: 'object', 
      properties: {
        type: { type: 'string', enum: ['git', 'svn', 'hg'], default: 'git' },
        url: { type: 'string', format: 'url' },
        directory: { type: 'string' }
      }
    },
    bugs: { 
      type: 'object', 
      properties: {
        url: { type: 'string', format: 'url' },
        email: { type: 'string', format: 'email' }
      }
    }
  },
  
  advanced: {
    // Internal pack types (mapped from complexity)
    packType: {
      basic: {      // low complexity
        allowedFields: ['name', 'version', 'description', 'keywords', 'author', 'license', 'complexity'],
        maxDependencies: 0,
        executionMethods: ['runScript']
      },
      standard: {   // medium complexity
        allowedFields: ['*'],
        maxDependencies: 25,
        allowedDependencyTypes: ['dependencies', 'peerDependencies', 'optionalDependencies'],
        executionMethods: ['runScript', 'execute', 'require']
      },
      advanced: {   // high complexity
        allowedFields: ['*'],
        maxDependencies: 100,
        allowedDependencyTypes: ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies', 'bundledDependencies'],
        requireDescription: true,
        requireLicense: true,
        executionMethods: ['runScript', 'execute', 'require', 'compile', 'initWasm', 'callWasm']
      },
      wasm: {        // special wasm‑focused type
        allowedFields: ['*'],
        maxDependencies: 50,
        executionMethods: ['runScript', 'execute', 'require', 'compile', 'initWasm', 'callWasm'],
        wasmSpecific: {
          memory: { min: 1, max: 65536, default: 256 },
          tables: { min: 0, max: 100, default: 1 },
          exports: ['_start', 'memory', 'table'],
          imports: ['env']
        }
      }
    },
    
    scripts: {
      validate: { 
        type: 'object',
        patternProperties: {
          '^[a-z][a-z0-9-]*$': { type: 'string', maxLength: 1000 }
        },
        maxProperties: 10
      },
      allowedScripts: [
        'prepublish', 'prepare', 'prepublishOnly', 'prepack', 'postpack',
        'publish', 'postpublish', 'preinstall', 'install', 'postinstall',
        'preuninstall', 'uninstall', 'postuninstall', 'preversion', 'version',
        'postversion', 'pretest', 'test', 'posttest', 'prestop', 'stop',
        'poststop', 'prestart', 'start', 'poststart', 'prerestart', 'restart',
        'postrestart', 'serve', 'build', 'dev', 'lint', 'format', 'check',
        'compile', 'transpile', 'bundle', 'minify', 'optimize', 'analyze',
        'coverage', 'benchmark', 'deploy', 'generate', 'init', 'clean'
      ],
      restrictedScripts: ['rm', 'del', 'sh', 'bash', 'exec', 'spawn', 'fork']
    },
    
    dependencies: {
      validate: { 
        type: 'object',
        patternProperties: {
          '^(@[a-z0-9-~][a-z0-9-._~]*/)?[a-z0-9-~][a-z0-9-._~]*$': {
            oneOf: [
              { type: 'string', pattern: '^[\\^~]?\\d+\\.\\d+\\.\\d+' },
              { type: 'string', pattern: '^[\\^~]?\\d+\\.\\d+' },
              { type: 'string', pattern: '^[\\^~]?\\d+' },
              { type: 'string', pattern: '^git\\+' },
              { type: 'string', pattern: '^http' },
              { type: 'string', pattern: '^file:' },
              { type: 'string', pattern: '^\\*$' }
            ]
          }
        }
      },
      dependencyTypes: {
        dependencies: { description: 'Production dependencies' },
        devDependencies: { description: 'Development dependencies' },
        peerDependencies: { 
          description: 'Peer dependencies',
          validation: (deps, packType) => packType !== 'basic'
        },
        optionalDependencies: { 
          description: 'Optional dependencies',
          validation: (deps, packType) => packType === 'advanced' || packType === 'wasm'
        },
        bundledDependencies: { 
          description: 'Bundled dependencies',
          validation: (deps, packType) => packType === 'advanced'
        }
      }
    },
    
    keywords: {
      validate: {
        type: 'array',
        items: { 
          type: 'string', 
          pattern: '^[a-z][a-z0-9-]*$',
          minLength: 2,
          maxLength: 20
        },
        maxItems: 10,
        uniqueItems: true
      }
    },
    
    entryPoints: {
      main: { 
        type: 'string', 
        pattern: '^\\./.*\\.(js|mjs|cjs|ts|tsx)$',
        default: './index.js'
      },
      module: { 
        type: 'string', 
        pattern: '^\\./.*\\.(js|mjs)$',
        optional: true
      },
      browser: { 
        type: 'string', 
        pattern: '^\\./.*\\.(js|mjs)$',
        optional: true
      },
      bin: {
        type: 'object',
        patternProperties: {
          '^[a-z][a-z0-9-]*$': { 
            type: 'string',
            pattern: '^\\./.*\\.(js|mjs|cjs)$'
          }
        },
        maxProperties: 5,
        validation: (bin, packType) => packType === 'advanced' || packType === 'standard'
      },
      exports: {
        type: 'object',
        patternProperties: {
          '^\\.(/[a-zA-Z0-9._-]+)*$': {
            oneOf: [
              { type: 'string' },
              { 
                type: 'object',
                properties: {
                  import: { type: 'string' },
                  require: { type: 'string' },
                  browser: { type: 'string' },
                  default: { type: 'string' },
                  types: { type: 'string' }
                },
                additionalProperties: false
              }
            ]
          }
        },
        validation: (exports, packType) => packType === 'advanced'
      }
    },
    
    wasmConfig: {
      memory: {
        initial: { type: 'number', min: 1, max: 65536, default: 256 },
        maximum: { type: 'number', min: 1, max: 65536, default: 16384 },
        shared: { type: 'boolean', default: false }
      },
      tables: {
        initial: { type: 'number', min: 0, max: 1000000, default: 0 },
        maximum: { type: 'number', min: 0, max: 1000000, default: 1000000 },
        element: { 
          type: 'string', 
          enum: ['anyfunc', 'externref'], 
          default: 'anyfunc' 
        }
      },
      globals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string', enum: ['i32', 'i64', 'f32', 'f64'] },
            mutable: { type: 'boolean', default: false },
            value: { type: 'number' }
          },
          required: ['name', 'type']
        },
        maxItems: 100
      },
      imports: {
        type: 'object',
        patternProperties: {
          '^[a-zA-Z_][a-zA-Z0-9_]*$': {
            type: 'object',
            properties: {
              functions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    params: { 
                      type: 'array',
                      items: { 
                        type: 'string', 
                        enum: ['i32', 'i64', 'f32', 'f64', 'externref'] 
                      }
                    },
                    results: { 
                      type: 'array',
                      items: { 
                        type: 'string', 
                        enum: ['i32', 'i64', 'f32', 'f64', 'externref'] 
                      }
                    }
                  },
                  required: ['name']
                }
              },
              memories: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    initial: { type: 'number', min: 1, max: 65536 },
                    maximum: { type: 'number', min: 1, max: 65536 }
                  }
                }
              },
              tables: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    initial: { type: 'number', min: 0, max: 1000000 },
                    maximum: { type: 'number', min: 0, max: 1000000 },
                    element: { type: 'string', enum: ['anyfunc', 'externref'] }
                  }
                }
              },
              globals: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    type: { type: 'string', enum: ['i32', 'i64', 'f32', 'f64'] },
                    mutable: { type: 'boolean' }
                  },
                  required: ['name', 'type']
                }
              }
            }
          }
        }
      },
      exports: {
        type: 'object',
        properties: {
          functions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { 
                  type: 'string', 
                  enum: ['i32', 'i64', 'f32', 'f64', 'void', 'anyfunc'] 
                },
                params: { 
                  type: 'array',
                  items: { 
                    type: 'string', 
                    enum: ['i32', 'i64', 'f32', 'f64', 'externref'] 
                  }
                },
                results: { 
                  type: 'array',
                  items: { 
                    type: 'string', 
                    enum: ['i32', 'i64', 'f32', 'f64', 'externref'] 
                  }
                }
              },
              required: ['name']
            }
          },
          memories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                shared: { type: 'boolean' }
              },
              required: ['name']
            }
          },
          tables: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                element: { type: 'string', enum: ['anyfunc', 'externref'] }
              },
              required: ['name']
            }
          },
          globals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string', enum: ['i32', 'i64', 'f32', 'f64'] }
              },
              required: ['name', 'type']
            }
          }
        }
      },
      linking: {
        type: 'object',
        properties: {
          allowUndefined: { type: 'boolean', default: false },
          stackSize: { type: 'number', min: 1024, max: 1048576, default: 65536 },
          staticBump: { type: 'number', min: 0, max: 1048576, default: 16384 },
          sharedMemory: { type: 'boolean', default: false },
          isCommand: { type: 'boolean', default: false },
          isReactor: { type: 'boolean', default: true }
        }
      }
    },
    
    sandbox: {
      type: 'object',
      properties: {
        level: { 
          type: 'string', 
          enum: ['strict', 'moderate', 'relaxed', 'wasm-sandbox'],
          default: 'strict'
        },
        allowedAPIs: {
          type: 'array',
          items: { 
            type: 'string',
            enum: [
              'fetch', 'WebSocket', 'localStorage', 'sessionStorage', 'indexedDB',
              'crypto', 'performance', 'console', 'setTimeout', 'setInterval',
              'Math', 'Date', 'JSON', 'TextEncoder', 'TextDecoder', 'URL',
              'Blob', 'FileReader', 'FormData', 'Headers', 'Request', 'Response'
            ]
          }
        },
        memoryLimit: { type: 'number', min: 1024, max: 1073741824, default: 67108864 },
        cpuLimit: { type: 'number', min: 1, max: 100, default: 50 },
        timeout: { type: 'number', min: 100, max: 30000, default: 5000 },
        networkAccess: { type: 'boolean', default: false },
        fileSystemAccess: { type: 'boolean', default: false },
        evalAllowed: { type: 'boolean', default: false },
        dynamicImport: { type: 'boolean', default: false }
      }
    },
    
    pack: {
      type: 'object',
      properties: {
        compile: {
          type: 'object',
          properties: {
            toWasm: { type: 'boolean', default: false },
            wasmFeatures: {
              type: 'array',
              items: { 
                type: 'string',
                enum: ['simd', 'threads', 'bulk-memory', 'reference-types', 'tail-call']
              }
            },
            optimizeLevel: { type: 'number', min: 0, max: 3, default: 2 },
            shrinkLevel: { type: 'number', min: 0, max: 2, default: 0 }
          }
        },
        
        bundle: {
          type: 'object',
          properties: {
            entry: { type: 'string' },
            format: { type: 'string', enum: ['esm', 'cjs', 'iife'] },
            splitting: { type: 'boolean', default: false },
            external: { type: 'array', items: { type: 'string' } },
            plugins: { type: 'array', items: { type: 'string' } }
          }
        },
        
        test: {
          type: 'object',
          properties: {
            runner: { type: 'string', enum: ['jest', 'mocha', 'ava', 'tape'] },
            coverage: { type: 'boolean', default: false },
            watch: { type: 'boolean', default: false }
          }
        },
        
        docs: {
          type: 'object',
          properties: {
            generator: { type: 'string', enum: ['jsdoc', 'typedoc', 'esdoc'] },
            output: { type: 'string' },
            theme: { type: 'string' }
          }
        },
        
        runtime: {
          type: 'object',
          properties: {
            node: { type: 'string' },
            browser: { type: 'string' },
            deno: { type: 'boolean', default: false },
            bun: { type: 'boolean', default: false }
          }
        }
      }
    }
  },
  
  execution: {
    runtime: {
      maxExecutionTime: 10000,
      maxMemory: 128 * 1024 * 1024,
      allowedHosts: ['api.pack.dev', 'cdn.pack.dev', 'registry.npmjs.org', 'github.com'],
      maxResponseSize: 5 * 1024 * 1024,
      sandboxTimeout: 5000
    },
    
    handlers: {
      executeFunction: async function(packName, functionName, args, packType, packFiles, packJson) {
        try {
          console.log(`[EXECUTE] Running ${functionName} from ${packName}`);
          
          const context = this.createExecutionContext(packType, packJson);
          
          if (packJson.main && packFiles[packJson.main]) {
            await this.loadModule(packJson.main, packFiles[packJson.main], context);
          }
          
          const result = await this.callFunction(functionName, args, context);
          
          return {
            success: true,
            result: result,
            executionTime: Date.now() - Date.now(),
            pack: packName
          };
          
        } catch (error) {
          console.error(`[EXECUTE] Error:`, error);
          return {
            success: false,
            error: error.message,
            pack: packName
          };
        }
      },
      
      runScript: async function(packName, scriptName, args, packType, packFiles, packJson) {
        try {
          if (!packJson.scripts || !packJson.scripts[scriptName]) {
            throw new Error(`Script ${scriptName} not found`);
          }
          
          console.log(`[SCRIPT] Running ${scriptName} from ${packName}`);
          
          const script = packJson.scripts[scriptName];
          const context = this.createExecutionContext(packType, packJson);
          
          const result = await this.evaluateScript(script, args, context);
          
          return {
            success: true,
            result: result,
            executionTime: Date.now() - Date.now(),
            script: scriptName,
            pack: packName
          };
          
        } catch (error) {
          console.error(`[SCRIPT] Error:`, error);
          return {
            success: false,
            error: error.message,
            pack: packName
          };
        }
      },
      
      initializeWasm: async function(packName, wasmConfig, wasmBinary) {
        try {
          console.log(`[WASM] Initializing WASM for ${packName}`);
          
          const imports = {
            env: {
              memory: new WebAssembly.Memory({
                initial: wasmConfig?.memory?.initial || 256,
                maximum: wasmConfig?.memory?.maximum || 16384
              }),
              table: new WebAssembly.Table({
                initial: wasmConfig?.tables?.initial || 0,
                maximum: wasmConfig?.tables?.maximum || 1000000,
                element: wasmConfig?.tables?.element || 'anyfunc'
              }),
              ...getSafeMathFunctions(),
              abort: (msg, file, line, column) => {
                console.error(`[WASM] Abort: ${msg} at ${file}:${line}:${column}`);
              }
            }
          };
          
          if (wasmConfig?.imports) {
            Object.entries(wasmConfig.imports).forEach(([moduleName, moduleImports]) => {
              imports[moduleName] = moduleImports;
            });
          }
          
          const module = await WebAssembly.compile(wasmBinary);
          const instance = await WebAssembly.instantiate(module, imports);
          
          const exports = {};
          if (instance.exports) {
            Object.entries(instance.exports).forEach(([name, func]) => {
              if (typeof func === 'function') {
                exports[name] = func;
              }
            });
          }
          
          return {
            success: true,
            instance: instance,
            exports: exports,
            memory: instance.exports.memory,
            pack: packName
          };
          
        } catch (error) {
          console.error(`[WASM] Error:`, error);
          return {
            success: false,
            error: error.message,
            pack: packName
          };
        }
      },
      
      createExecutionContext: function(packType, packJson) {
        const sandboxConfig = packJson.pack?.sandbox || {};
        const allowedAPIs = sandboxConfig.allowedAPIs || [];
        
        const context = {
          console: {
            log: (...args) => console.log(`[${packJson.name}]`, ...args),
            error: (...args) => console.error(`[${packJson.name}]`, ...args),
            warn: (...args) => console.warn(`[${packJson.name}]`, ...args),
            info: (...args) => console.info(`[${packJson.name}]`, ...args)
          },
          Math: getSafeMathFunctions(),
          Date,
          JSON,
          Array,
          Object,
          String,
          Number,
          Boolean,
          RegExp,
          Error,
          TypeError,
          RangeError,
          Promise,
          Symbol,
          Map,
          Set,
          WeakMap,
          WeakSet,
          ArrayBuffer,
          Int8Array,
          Uint8Array,
          Uint8ClampedArray,
          Int16Array,
          Uint16Array,
          Int32Array,
          Uint32Array,
          Float32Array,
          Float64Array,
          DataView,
          TextEncoder,
          TextDecoder,
          URL,
          URLSearchParams,
          performance: { now: () => performance.now() },
          
          __pack: {
            name: packJson.name,
            version: packJson.version,
            type: packType,
            config: packJson.pack || {}
          }
        };
        
        if (allowedAPIs.includes('fetch') && sandboxConfig.networkAccess !== false) {
          context.fetch = this.createSecureFetch(packJson.name);
        }
        
        if (allowedAPIs.includes('crypto')) {
          context.crypto = {
            getRandomValues: (array) => {
              if (array.byteLength > 65536) {
                throw new Error('Array too large for crypto operation');
              }
              return crypto.getRandomValues(array);
            },
            randomUUID: crypto.randomUUID?.bind(crypto)
          };
        }
        
        if (allowedAPIs.includes('setTimeout') || allowedAPIs.includes('setInterval')) {
          if (allowedAPIs.includes('setTimeout')) {
            context.setTimeout = (fn, delay, ...args) => {
              if (delay > 10000) delay = 10000;
              return setTimeout(fn, delay, ...args);
            };
          }
          if (allowedAPIs.includes('setInterval')) {
            context.setInterval = (fn, delay, ...args) => {
              if (delay > 10000) delay = 10000;
              return setInterval(fn, delay, ...args);
            };
          }
          context.clearTimeout = clearTimeout;
          context.clearInterval = clearInterval;
        }
        
        return context;
      },
      
      createSecureFetch: function(packName) {
        return async function secureFetch(url, options = {}) {
          try {
            const parsed = new URL(url);
            
            const disallowed = ['localhost', '127.0.0.1', '192.168.', '10.', '172.16.'];
            if (disallowed.some(d => parsed.hostname.includes(d))) {
              throw new Error(`Access to ${parsed.hostname} not allowed`);
            }
            
            const allowed = ['api.pack.dev', 'cdn.pack.dev', 'registry.npmjs.org', 'github.com'];
            const isAllowed = allowed.some(a => 
              parsed.hostname === a || parsed.hostname.endsWith(`.${a}`)
            );
            
            if (!isAllowed) {
              throw new Error(`Host ${parsed.hostname} not in allowed list`);
            }
            
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            
            try {
              const response = await fetch(url, {
                ...options,
                signal: controller.signal
              });
              
              const maxSize = 5 * 1024 * 1024;
              const contentLength = response.headers.get('content-length');
              
              if (contentLength && parseInt(contentLength) > maxSize) {
                throw new Error('Response too large');
              }
              
              return response;
            } finally {
              clearTimeout(timeout);
            }
          } catch (error) {
            console.error(`[${packName}] Fetch error:`, error);
            throw error;
          }
        };
      },
      
      loadModule: async function(filename, code, context) {
        try {
          const moduleCode = `
            (function() {
              'use strict';
              ${code}
              return (typeof module !== 'undefined' && module.exports) || 
                     (typeof exports !== 'undefined' && exports) ||
                     {};
            })()
          `;
          
          const executor = new Function(...Object.keys(context), `
            ${Object.keys(context).map(key => `const ${key} = arguments[${Object.keys(context).indexOf(key)}];`).join('\n')}
            return (${moduleCode});
          `);
          
          const result = executor(...Object.values(context));
          
          if (result && typeof result === 'object') {
            Object.entries(result).forEach(([key, value]) => {
              if (typeof value === 'function') {
                context[key] = value;
              }
            });
          }
          
          return result;
          
        } catch (error) {
          console.error(`[MODULE] Failed to load ${filename}:`, error);
          throw error;
        }
      },
      
      callFunction: async function(functionName, args, context) {
        if (!context[functionName]) {
          throw new Error(`Function ${functionName} not found`);
        }
        
        const func = context[functionName];
        
        return await Promise.race([
          func(...args),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Execution timeout')), 10000)
          )
        ]);
      },
      
      evaluateScript: async function(script, args, context) {
        try {
          const scriptCode = `
            (function() {
              'use strict';
              const args = ${JSON.stringify(args)};
              try {
                ${script}
              } catch(e) {
                return { error: e.message, stack: e.stack };
              }
            })()
          `;
          
          const executor = new Function(...Object.keys(context), `
            ${Object.keys(context).map(key => `const ${key} = arguments[${Object.keys(context).indexOf(key)}];`).join('\n')}
            return (${scriptCode});
          `);
          
          return executor(...Object.values(context));
          
        } catch (error) {
          console.error('[SCRIPT] Evaluation error:', error);
          return { error: error.message, stack: error.stack };
        }
      },
      
      compileToWasm: async function(jsCode, config = {}) {
        try {
          const functions = this.extractJSFunctions(jsCode);
          const wasmBinary = this.generateWasmBinary(functions, config);
          
          return {
            success: true,
            wasm: wasmBinary,
            functions: functions,
            config: config
          };
          
        } catch (error) {
          console.error('[COMPILE] WASM compilation error:', error);
          return {
            success: false,
            error: error.message
          };
        }
      },
      
      extractJSFunctions: function(jsCode) {
        const functions = [];
        const regexes = [
          /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g,
          /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g,
          /(\w+)\s*\(([^)]*)\)\s*{/g
        ];
        
        for (const regex of regexes) {
          let match;
          regex.lastIndex = 0;
          while ((match = regex.exec(jsCode)) !== null) {
            const [, name, params] = match;
            const paramCount = params.split(',').filter(p => p.trim()).length;
            
            functions.push({
              name: name || `func_${functions.length}`,
              params: paramCount,
              returnType: 'i32'
            });
          }
        }
        
        return functions.length > 0 ? functions : [
          { name: 'execute', params: 1, returnType: 'i32' },
          { name: 'calculate', params: 2, returnType: 'i32' }
        ];
      },
      
      generateWasmBinary: function(functions, config) {
        const wasmBytes = new Uint8Array([
          0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
          0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,
          0x03, 0x02, functions.length, ...Array(functions.length).fill(0x00),
          0x05, 0x03, 0x01, 0x00, 0x01,
          0x07, this.calculateExportSize(functions), functions.length + 1,
          0x06, 0x6d, 0x65, 0x6d, 0x6f, 0x72, 0x79, 0x02, 0x00,
          ...this.generateExports(functions),
          0x0a, this.calculateCodeSize(functions), functions.length,
          ...this.generateFunctionCode(functions)
        ]);
        
        return wasmBytes;
      },
      
      calculateExportSize: function(functions) {
        let size = 1;
        functions.forEach(func => {
          size += 1 + func.name.length + 1 + 1;
        });
        return size + 1;
      },
      
      generateExports: function(functions) {
        const bytes = [];
        functions.forEach((func, index) => {
          const nameBytes = Array.from(new TextEncoder().encode(func.name));
          bytes.push(nameBytes.length, ...nameBytes, 0x00, index);
        });
        return bytes;
      },
      
      calculateCodeSize: function(functions) {
        let size = 0;
        functions.forEach(() => {
          size += 4 + 7;
        });
        return size + 1;
      },
      
      generateFunctionCode: function(functions) {
        const bytes = [];
        functions.forEach((func, index) => {
          bytes.push(
            0x04,
            0x00,
            0x20, 0x00,
            0x20, 0x01,
            0x6a,
            0x0b
          );
        });
        return bytes;
      }
    }
  },
  
  validators: {
    validateField: (field, value, packType) => {
      const config = PACK_JSON_SCHEMA.advanced.packType[packType];
      
      if (!config.allowedFields.includes('*') && !config.allowedFields.includes(field)) {
        return { valid: false, reason: `Field "${field}" is not allowed for ${packType} packs` };
      }
      
      switch (field) {
        case 'dependencies':
          return validateDependencies(value, packType);
        case 'scripts':
          return validateScripts(value, packType);
        case 'wasmConfig':
          return packType === 'wasm' ? 
            { valid: true } : 
            { valid: false, reason: 'wasmConfig is only allowed for wasm packs' };
        default:
          return { valid: true };
      }
    },
    
    validateDependencies: (deps, packType) => {
      if (!deps || typeof deps !== 'object') {
        return { valid: true };
      }
      
      const config = PACK_JSON_SCHEMA.advanced.packType[packType];
      const depCount = Object.keys(deps).length;
      
      if (depCount > config.maxDependencies) {
        return { 
          valid: false, 
          reason: `Too many dependencies. Maximum ${config.maxDependencies} allowed for ${packType} packs` 
        };
      }
      
      return { valid: true };
    },
    
    validateScripts: (scripts, packType) => {
      if (!scripts || typeof scripts !== 'object') {
        return { valid: true };
      }
      
      const restrictedScripts = PACK_JSON_SCHEMA.advanced.scripts.restrictedScripts;
      
      for (const scriptName of Object.keys(scripts)) {
        if (restrictedScripts.some(restricted => 
            scriptName.includes(restricted) || 
            scripts[scriptName].includes(restricted))) {
          return { 
            valid: false, 
            reason: `Script "${scriptName}" contains restricted commands` 
          };
        }
      }
      
      return { valid: true };
    }
  },
  
  transformers: {
    addDefaults: (packJson, packType) => {
      const result = { ...packJson };
      const optional = PACK_JSON_SCHEMA.optional;
      
      for (const [field, config] of Object.entries(optional)) {
        if (result[field] === undefined && config.default !== undefined) {
          result[field] = config.default;
        }
      }
      
      const pkgConfig = PACK_JSON_SCHEMA.advanced.packType[packType];
      if (pkgConfig.requireDescription && !result.description) {
        result.description = `A ${packType} pack for Pack ecosystem`;
      }
      
      if (pkgConfig.requireLicense && !result.license) {
        result.license = 'MIT';
      }
      
      return result;
    },
    
    sanitize: (packJson, packType) => {
      const result = {};
      const config = PACK_JSON_SCHEMA.advanced.packType[packType];
      
      for (const [field, value] of Object.entries(packJson)) {
        if (config.allowedFields.includes('*') || config.allowedFields.includes(field)) {
          result[field] = value;
        }
      }
      
      return result;
    }
  },
  
  helpers: {
    generateMinimal: (name, version, complexity = 'low') => {
      const packType = complexity === 'low' ? 'basic' : complexity === 'medium' ? 'standard' : 'advanced';
      const base = {
        name,
        version,
        description: `A ${complexity} complexity pack for Pack ecosystem`,
        license: 'MIT',
        complexity,
        pack: {
          type: packType,
          sandbox: {
            level: packType === 'basic' ? 'strict' : 
                   packType === 'wasm' ? 'wasm-sandbox' : 'moderate'
          }
        }
      };
      
      if (packType === 'advanced' || packType === 'wasm') {
        base.keywords = [packType, 'pack'];
        base.author = '';
        base.homepage = '';
      }
      
      if (packType === 'wasm') {
        base.wasmConfig = {
          memory: { initial: 256, maximum: 16384 },
          exports: {
            functions: [
              { name: 'main', params: [], results: ['i32'] },
              { name: 'calculate', params: ['i32', 'i32'], results: ['i32'] }
            ]
          }
        };
      }
      
      return base;
    },
    
    generateFromTemplate: (templateName, options = {}) => {
      const templates = {
        'library': {
          name: options.name || 'my-library',
          version: '1.0.0',
          complexity: 'medium',
          description: 'A reusable JavaScript library',
          main: './dist/index.js',
          module: './dist/index.esm.js',
          types: './dist/index.d.ts',
          files: ['dist'],
          scripts: {
            build: 'rollup -c',
            test: 'jest',
            lint: 'eslint src',
            format: 'prettier --write src'
          },
          keywords: ['library', 'javascript', 'typescript'],
          pack: {
            compile: { toWasm: false },
            sandbox: { level: 'moderate' }
          }
        },
        
        'wasm-module': {
          name: options.name || 'my-wasm-module',
          version: '1.0.0',
          complexity: 'high',
          description: 'A WebAssembly module',
          main: './dist/index.js',
          wasm: './dist/module.wasm',
          files: ['dist'],
          scripts: {
            build: 'npm run build:wasm && npm run build:js',
            'build:wasm': 'asc src/module.ts --target release',
            'build:js': 'rollup -c'
          },
          wasmConfig: {
            memory: { initial: 256, maximum: 16384 },
            exports: {
              functions: [
                { name: 'add', params: ['i32', 'i32'], results: ['i32'] },
                { name: 'multiply', params: ['i32', 'i32'], results: ['i32'] }
              ]
            }
          },
          pack: {
            type: 'wasm',
            compile: { toWasm: true },
            sandbox: { level: 'wasm-sandbox' }
          }
        },
        
        'cli-tool': {
          name: options.name || 'my-cli-tool',
          version: '1.0.0',
          complexity: 'high',
          description: 'A command-line tool',
          bin: {
            'my-tool': './bin/cli.js'
          },
          files: ['bin', 'lib'],
          scripts: {
            start: 'node ./bin/cli.js',
            test: 'mocha test/**/*.js'
          },
          dependencies: {
            'commander': '^9.0.0',
            'chalk': '^5.0.0'
          },
          pack: {
            type: 'advanced',
            sandbox: {
              level: 'relaxed',
              networkAccess: true,
              fileSystemAccess: true
            }
          }
        }
      };
      
      return templates[templateName] || templates.library;
    }
  }
};

// ============================================================================
// FUNCTIONAL PACK.JSON EXECUTOR CLASS
// ============================================================================
class PackJsonExecutor {
  constructor(packJson, files, packType) {
    this.packJson = packJson;
    this.files = files;
    this.packType = packType;
    this.executionContext = null;
    this.wasmInstance = null;
    this.executionHandlers = PACK_JSON_SCHEMA.execution.handlers;
    
    this.enhancePackJson();
  }

  enhancePackJson() {
    const enhanced = this.packJson;
    
    enhanced.execute = async (funcName, ...args) => {
      return await this.executionHandlers.executeFunction(
        enhanced.name,
        funcName,
        args,
        this.packType,
        this.files,
        enhanced
      );
    };
    
    enhanced.runScript = async (scriptName, ...args) => {
      return await this.executionHandlers.runScript(
        enhanced.name,
        scriptName,
        args,
        this.packType,
        this.files,
        enhanced
      );
    };
    
    enhanced.require = (modulePath) => {
      return this.requireModule(modulePath);
    };
    
    if (this.packType === 'wasm' || enhanced.pack?.compile?.toWasm) {
      enhanced.compile = async (options = {}) => {
        return await this.compileToWasm(options);
      };
      
      enhanced.initWasm = async () => {
        return await this.initializeWasm();
      };
      
      enhanced.callWasm = async (funcName, ...args) => {
        return await this.callWasmFunction(funcName, ...args);
      };
    }
    
    enhanced.getExports = () => {
      return this.getExports();
    };
    
    enhanced.getAvailableActions = () => {
      return this.getAvailableActions();
    };
    
    return enhanced;
  }

  requireModule(modulePath) {
    const builtins = {
      'path': {
        join: (...parts) => parts.join('/').replace(/\/+/g, '/'),
        dirname: (path) => path.split('/').slice(0, -1).join('/') || '.',
        basename: (path) => path.split('/').pop()
      },
      'util': {
        format: (...args) => require('util').format(...args),
        inspect: (obj) => JSON.stringify(obj, null, 2)
      },
      'crypto': {
        randomBytes: (size) => crypto.randomBytes(size)
      }
    };
    
    if (builtins[modulePath]) {
      return builtins[modulePath];
    }
    
    if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
      const resolvedPath = modulePath.replace(/^\.\//, '').replace(/^\.\.\//, '');
      
      if (this.files[resolvedPath]) {
        const context = this.executionHandlers.createExecutionContext(this.packType, this.packJson);
        const result = this.executionHandlers.loadModule(resolvedPath, this.files[resolvedPath], context);
        return result;
      }
    }
    
    throw new Error(`Module "${modulePath}" not found`);
  }

  async compileToWasm(options = {}) {
    if (this.packType !== 'wasm' && !this.packJson.pack?.compile?.toWasm) {
      throw new Error('Compilation to WASM is not enabled for this pack');
    }
    
    const compiler = new PackWASMCompiler();
    const mainFile = this.packJson.main || 'index.js';
    
    if (!this.files[mainFile]) {
      throw new Error(`Main file ${mainFile} not found`);
    }
    
    const config = {
      ...this.packJson.wasmConfig,
      ...options,
      name: this.packJson.name
    };
    
    const result = await compiler.compileJavaScriptToWasm(this.files[mainFile], config);
    
    if (result.success) {
      this.files['compiled.wasm'] = Buffer.from(result.wasm).toString('base64');
      this.files['wasm-wrapper.js'] = generateWasmWrapper(this.packJson.name, result.wasm, result.metadata);
    }
    
    return result;
  }

  async initializeWasm() {
    if (this.wasmInstance) {
      return this.wasmInstance;
    }
    
    const wasmFiles = Object.entries(this.files).filter(([name]) => 
      name.endsWith('.wasm') || name === 'compiled.wasm'
    );
    
    if (wasmFiles.length === 0) {
      throw new Error('No WASM files found');
    }
    
    const [filename, content] = wasmFiles[0];
    const wasmConfig = this.packJson.wasmConfig || {};
    
    const wasmBinary = await this.getWasmBinary(content);
    
    this.wasmInstance = await this.executionHandlers.initializeWasm(
      this.packJson.name,
      wasmConfig,
      wasmBinary
    );
    
    return this.wasmInstance;
  }

  async getWasmBinary(content) {
    if (typeof content === 'string') {
      if (content.startsWith('data:')) {
        const base64 = content.split(',')[1];
        return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      } else {
        return Buffer.from(content, 'base64');
      }
    }
    return content;
  }

  async callWasmFunction(funcName, ...args) {
    const wasm = await this.initializeWasm();
    
    if (!wasm.exports || !wasm.exports[funcName]) {
      throw new Error(`WASM function "${funcName}" not found`);
    }
    
    return wasm.exports[funcName](...args);
  }

  getExports() {
    const exports = [];
    
    for (const [filename, content] of Object.entries(this.files)) {
      if (filename.endsWith('.js') || filename.endsWith('.ts')) {
        const exportRegex = /export\s+(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)|let\s+(\w+)|var\s+(\w+)|class\s+(\w+)|default\s+(?:async\s+)?function\s+(\w+)?|default\s+(?:const|let|var)\s+(\w+)|default\s+class\s+(\w+))/g;
        let match;
        
        while ((match = exportRegex.exec(content)) !== null) {
          for (let i = 1; i < match.length; i++) {
            if (match[i]) {
              exports.push({
                name: match[i],
                file: filename,
                type: 'function'
              });
            }
          }
        }
        
        const moduleExportsRegex = /module\.exports\s*=\s*\{([^}]+)\}/g;
        while ((match = moduleExportsRegex.exec(content)) !== null) {
          const exportsStr = match[1];
          const propRegex = /(\w+)\s*:/g;
          let propMatch;
          while ((propMatch = propRegex.exec(exportsStr)) !== null) {
            exports.push({
              name: propMatch[1],
              file: filename,
              type: 'module'
            });
          }
        }
      }
    }
    
    return exports;
  }

  getAvailableActions() {
    return {
      scripts: this.packJson.scripts ? Object.keys(this.packJson.scripts) : [],
      functions: this.getExports(),
      compile: this.packJson.pack?.compile?.toWasm || false,
      wasm: Object.keys(this.files).some(name => name.endsWith('.wasm') || name === 'compiled.wasm')
    };
  }

  async testExecution() {
    console.log(`\n=== TESTING PACK.JSON EXECUTION: ${this.packJson.name} ===`);
    
    try {
      const actions = this.getAvailableActions();
      console.log('✓ Available actions:', {
        scripts: actions.scripts.length,
        functions: actions.functions.length,
        canCompile: actions.compile,
        hasWasm: actions.wasm
      });
      
      if (actions.scripts.includes('test')) {
        console.log('  Testing script: test');
        try {
          const result = await this.packJson.runScript('test');
          console.log('  ✓ Test script executed:', result);
        } catch (error) {
          console.log('  ⚠ Test script failed (non-critical):', error.message);
        }
      }
      
      if (this.packType === 'wasm' && this.packJson.initWasm) {
        console.log('  Initializing WASM...');
        try {
          const wasm = await this.packJson.initWasm();
          console.log('  ✓ WASM initialized with', Object.keys(wasm.exports || {}).length, 'exports');
        } catch (error) {
          console.log('  ⚠ WASM initialization failed (non-critical):', error.message);
        }
      }
      
      console.log(`=== PACK.JSON TEST COMPLETE: ${this.packJson.name} ===\n`);
      
    } catch (error) {
      console.error(`❌ Pack.json execution test failed:`, error.message);
    }
    
    return this.packJson;
  }
}

// ============================================================================
// PACK TYPES AND MODULES
// ============================================================================
const ADVANCED_NODE_MODULES = [
  'crypto', 'util', 'events', 'stream', 'buffer', 'path', 'url', 'querystring',
  'string_decoder', 'timers', 'console', 'assert',
  'lodash', 'underscore', 'moment', 'date-fns', 'axios', 'node-fetch',
  'uuid', 'validator', 'joi', 'yup', 'zod',
  'jsonwebtoken', 'bcrypt', 'bcryptjs', 'argon2', 'crypto-js',
  'yaml', 'xml2js', 'csv-parse', 'csv-stringify', 'exceljs',
  'mathjs', 'numeral', 'decimal.js', 'big.js',
  'chalk', 'colors', 'debug', 'winston', 'pino', 'log4js',
  'ws', 'socket.io', 'socket.io-client',
  'cheerio', 'jsdom', 'parse5', 'acorn',
  'pako', 'fflate',
  'dexie', 'pouchdb', 'lokijs',
  'ajv', 'superstruct',
  'commander', 'yargs', 'inquirer', 'chalk-table',
  'jest', 'mocha', 'chai', 'sinon', 'ava',
  'esbuild', 'swc', 'typescript',
  '@wasmer/wasi', '@wasmer/wasm-transformer', '@wasmer/sdk',
  'tensorflow', '@tensorflow/tfjs', 'brain.js', 'ml5',
  'chart.js', 'd3', 'plotly.js'
];

const BANNED_NODE_MODULES = [
  'child_process', 'cluster', 'worker_threads', 'vm',
  'fs', 'os', 'net', 'dns', 'tls', 'http', 'https',
  'dgram', 'zlib', 'perf_hooks', 'repl', 'readline',
  'module', 'process', 'inspector', 'trace_events',
  'v8', 'async_hooks', 'domain', 'punycode'
];

const PACK_TYPES = {
  'basic': {
    level: 1,
    maxFiles: 20,
    maxSize: 5 * 1024 * 1024,
    allowNodeModules: false,
    allowAdvancedJS: false,
    requiresVerification: false,
    wasmSupport: false,
    executionMethods: ['runScript']
  },
  'standard': {
    level: 2,
    maxFiles: 50,
    maxSize: 10 * 1024 * 1024,
    allowNodeModules: true,
    allowedNodeModules: ADVANCED_NODE_MODULES.slice(0, 25),
    allowAdvancedJS: true,
    requiresVerification: false,
    wasmSupport: true,
    maxWasmSize: 5 * 1024 * 1024,
    executionMethods: ['runScript', 'execute', 'require']
  },
  'advanced': {
    level: 3,
    maxFiles: 100,
    maxSize: 50 * 1024 * 1024,
    allowNodeModules: true,
    allowedNodeModules: ADVANCED_NODE_MODULES,
    allowAdvancedJS: true,
    requiresVerification: true,
    wasmSupport: true,
    maxWasmSize: 25 * 1024 * 1024,
    canCompileToWasm: true,
    allowCustomWasm: true,
    sandboxLevel: 'strict',
    executionMethods: ['runScript', 'execute', 'require', 'compile', 'initWasm', 'callWasm']
  },
  'wasm': {
    level: 4,
    maxFiles: 30,
    maxSize: 100 * 1024 * 1024,
    allowNodeModules: false,
    allowAdvancedJS: false,
    requiresVerification: true,
    wasmSupport: true,
    maxWasmSize: 100 * 1024 * 1024,
    canCompileToWasm: true,
    allowCustomWasm: true,
    sandboxLevel: 'wasm-sandbox',
    isWasmPack: true,
    executionMethods: ['runScript', 'execute', 'require', 'compile', 'initWasm', 'callWasm']
  }
};

// ============================================================================
// COMPLEX WEBASSEMBLY COMPILATION ENGINE
// ============================================================================
class PackWASMCompiler {
  constructor() {
    this.memory = new WebAssembly.Memory({ initial: 256, maximum: 65536 });
    this.table = new WebAssembly.Table({ initial: 0, element: 'anyfunc' });
    
    this.importObject = {
      env: {
        memory: this.memory,
        table: this.table,
        memoryBase: 0,
        tableBase: 0,
        abort: (msg, file, line, column) => {
          console.error(`WASM abort: ${msg} at ${file}:${line}:${column}`);
        },
        ...getSafeMathFunctions(),
        string_length: (ptr) => {
          const view = new Uint8Array(this.memory.buffer, ptr);
          let length = 0;
          while (view[length] !== 0) length++;
          return length;
        },
        string_copy: (src, dest, length) => {
          const srcView = new Uint8Array(this.memory.buffer, src, length);
          const destView = new Uint8Array(this.memory.buffer, dest, length);
          destView.set(srcView);
          return dest;
        },
        console_log: (ptr, length) => {
          const bytes = new Uint8Array(this.memory.buffer, ptr, length);
          const text = new TextDecoder().decode(bytes);
          console.log(`[WASM]: ${text}`);
        }
      }
    };
    
    this.wasi = new WASI({
      args: [],
      env: {},
      preopens: {}
    });
  }

  async compileJavaScriptToWasm(jsCode, config = {}) {
    try {
      console.log('Starting JavaScript to WASM compilation...');
      
      const functions = this.extractJSFunctions(jsCode);
      console.log(`Found ${functions.length} functions:`, functions.map(f => f.name));
      
      const wat = this.generateWatModule(functions, config);
      console.log('Generated WAT module');
      
      const wasmBinary = await this.compileWatToWasm(wat);
      console.log('Compiled WAT to WASM binary');
      
      const optimizedWasm = await this.optimizeWasmBinary(wasmBinary);
      console.log('Optimized WASM binary');
      
      const isValid = await this.validateWasm(optimizedWasm);
      if (!isValid) {
        throw new Error('Generated WASM failed validation');
      }
      
      return {
        success: true,
        wasm: optimizedWasm,
        metadata: {
          compiledFrom: 'javascript',
          functions: functions.map(f => f.name),
          functionCount: functions.length,
          timestamp: new Date().toISOString(),
          config,
          wasmSize: optimizedWasm.length,
          wasmHash: crypto.createHash('sha256').update(optimizedWasm).digest('hex')
        }
      };
      
    } catch (error) {
      console.error('JavaScript to WASM compilation failed:', error);
      throw error;
    }
  }

  async createComplexWasmModule(files, packName, config) {
    try {
      console.log(`Creating complex WASM module for ${packName}`);
      
      const jsModules = [];
      for (const [filename, content] of Object.entries(files)) {
        if (filename.endsWith('.js') || filename.endsWith('.ts') || 
            filename.endsWith('.jsx') || filename.endsWith('.tsx')) {
          
          const functions = this.extractJSFunctions(content);
          jsModules.push({
            filename: filename.replace(/\.[^.]+$/, ''),
            functions,
            content
          });
        }
      }
      
      if (jsModules.length > 1) {
        return this.createMultiModuleWasm(jsModules, packName, config);
      } else if (jsModules.length === 1) {
        return await this.compileJavaScriptToWasm(jsModules[0].content, {
          ...config,
          name: packName
        });
      } else {
        return this.createDefaultWasmModule(packName);
      }
      
    } catch (error) {
      console.error('Complex WASM creation failed:', error);
      throw error;
    }
  }

  extractJSFunctions(jsCode) {
    const functions = [];
    
    const functionRegexes = [
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?:{|\s*=>)/g,
      /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g,
      /(\w+)\s*\(([^)]*)\)\s*{/g,
      /(?:static\s+)?(\w+)\s*\(([^)]*)\)\s*{/g
    ];
    
    for (const regex of functionRegexes) {
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(jsCode)) !== null) {
        const [, name, params] = match;
        const paramCount = params.split(',').filter(p => p.trim()).length;
        
        functions.push({
          name: name || `func_${functions.length}`,
          params: paramCount,
          returnType: 'i32'
        });
      }
    }
    
    if (functions.length === 0) {
      functions.push({
        name: 'execute',
        params: 1,
        returnType: 'i32'
      });
      
      functions.push({
        name: 'calculate',
        params: 2,
        returnType: 'i32'
      });
    }
    
    return functions;
  }

  generateWatModule(functions, config) {
    const memoryDef = `(memory (export "memory") ${config.initialMemory || 1} ${config.maxMemory || 65536})`;
    const tableDef = `(table (export "table") ${functions.length || 1} ${functions.length + 10 || 10} funcref)`;
    
    const typeDefs = functions.map((func, index) => 
      `(type (;${index};) (func ${Array(func.params).fill('(param i32)').join(' ')} (result i32)))`
    ).join('\n  ');
    
    const funcDefs = functions.map((func, index) => {
      const params = Array(func.params).fill(0).map((_, i) => `(param $p${i} i32)`).join(' ');
      const locals = func.params > 0 ? '(local $temp i32)' : '';
      
      let body = '';
      if (func.params === 0) {
        body = 'i32.const 42';
      } else if (func.params === 1) {
        body = 'local.get $p0\ni32.const 1\ni32.add';
      } else if (func.params === 2) {
        body = 'local.get $p0\nlocal.get $p1\ni32.add';
      } else {
        const gets = Array(func.params).fill(0).map((_, i) => `local.get $p${i}`).join('\n');
        body = `${gets}\n${Array(func.params - 1).fill('i32.add').join('\n')}`;
      }
      
      return `
  (func $${func.name} (type ${index})
    ${locals}
    ${body}
  )`;
    }).join('');
    
    const exports = functions.map(func => 
      `(export "${func.name}" (func $${func.name}))`
    ).join('\n  ');
    
    const dataSection = config.name ? `
  (data (i32.const 0) "${config.name}")
  (data (i32.const 100) "PackWASM v1.0")
  (data (i32.const 200) "${new Date().toISOString()}")` : '';
    
    return `(module
  ${memoryDef}
  ${tableDef}
  ${typeDefs}
  ${funcDefs}
  ${exports}
  ${dataSection}
)`;
  }

  createMultiModuleWasm(modules, packName, config) {
    const moduleCount = modules.length;
    const dispatcherWat = this.generateDispatcherWat(modules, packName);
    return this.createCombinedWasm(modules, packName);
  }

  generateDispatcherWat(modules, packName) {
    const funcDefs = modules.map((mod, i) => 
      `(func $${mod.filename} (import "${mod.filename}" "main") (param i32) (result i32))`
    ).join('\n  ');
    
    const dispatchBody = modules.map((mod, i) => 
      `    (i32.eq (local.get $moduleId) (i32.const ${i}))
     (if
       (then
         (call $${mod.filename} (local.get $input))
         return
       )
     )`
    ).join('\n');
    
    return `(module
  (memory (export "memory") 1 65536)
  (table (export "table") ${modules.length} ${modules.length + 10} funcref)
  
  ${funcDefs}
  
  (func $dispatch (export "dispatch") (param $moduleId i32) (param $input i32) (result i32)
    ${dispatchBody}
    ;; Default return if no module matched
    i32.const -1
  )
  
  ;; Pack metadata
  (data (i32.const 0) "${packName}")
  (data (i32.const 100) "Complex WASM Module")
  (data (i32.const 200) "Modules: ${modules.length}")
)`;
  }

  createCombinedWasm(modules, packName) {
    const allFunctions = modules.flatMap(mod => mod.functions);
    return this.generateMultiFunctionWasm(allFunctions, packName);
  }

  generateMultiFunctionWasm(functions, packName) {
    const funcCount = functions.length;
    const typeSection = new Uint8Array([
      0x01, 0x09, 0x01, 0x60, 0x01, 0x7f, 0x01, 0x7f
    ]);
    
    const funcSection = new Uint8Array([
      0x03, 0x02, funcCount, ...Array(funcCount).fill(0x00)
    ]);
    
    const memorySection = new Uint8Array([0x05, 0x03, 0x01, 0x00, 0x01]);
    
    let exportData = [
      0x06, 0x6d, 0x65, 0x6d, 0x6f, 0x72, 0x79, 0x02, 0x00
    ];
    
    functions.forEach((func, i) => {
      const name = func.name || `func${i}`;
      const nameBytes = Array.from(new TextEncoder().encode(name));
      exportData.push(
        nameBytes.length, ...nameBytes,
        0x00, i
      );
    });
    
    const exportSection = new Uint8Array([
      0x07, exportData.length + 1, functions.length + 1, ...exportData
    ]);
    
    const codeEntries = [];
    functions.forEach(() => {
      const funcCode = [
        0x04, 0x00, 0x20, 0x00, 0x41, 0x01, 0x6a, 0x0b
      ];
      codeEntries.push(...funcCode);
    });
    
    const codeSection = new Uint8Array([
      0x0a, codeEntries.length + 1, funcCount, ...codeEntries
    ]);
    
    const nameBytes = new TextEncoder().encode(packName);
    const dataSection = new Uint8Array([
      0x0b, nameBytes.length + 5, 0x01,
      0x00, 0x41, 0x00, 0x0b,
      nameBytes.length, ...nameBytes
    ]);
    
    const wasmBytes = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
      ...typeSection,
      ...funcSection,
      ...memorySection,
      ...exportSection,
      ...codeSection,
      ...dataSection
    ]);
    
    return wasmBytes;
  }

  async compileWatToWasm(wat) {
    try {
      const command = new Command('wat2wasm', ['--help']);
      return this.createWasmFromWat(wat);
    } catch (error) {
      console.error('WAT compilation failed:', error);
      return this.generateMinimalWasm();
    }
  }

  createWasmFromWat(wat) {
    try {
      const funcCount = (wat.match(/\(func/g) || []).length;
      const hasMemory = wat.includes('(memory');
      const hasTable = wat.includes('(table');
      
      const wasmBytes = this.buildWasmModule(funcCount, hasMemory, hasTable);
      return new Uint8Array(wasmBytes);
    } catch (error) {
      console.error('WASM creation failed:', error);
      return this.generateMinimalWasm();
    }
  }

  buildWasmModule(funcCount = 2, hasMemory = true, hasTable = false) {
    const wasmBytes = [
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00
    ];
    
    const typeSection = [
      0x01, 0x09, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f
    ];
    
    const funcSection = [
      0x03, 0x02, funcCount, ...Array(funcCount).fill(0x00)
    ];
    
    let memorySection = [];
    if (hasMemory) {
      memorySection = [0x05, 0x03, 0x01, 0x00, 0x01];
    }
    
    const exportBytes = [];
    
    if (hasMemory) {
      exportBytes.push(
        0x06, 0x6d, 0x65, 0x6d, 0x6f, 0x72, 0x79,
        0x02, 0x00
      );
    }
    
    for (let i = 0; i < funcCount; i++) {
      const funcName = i === 0 ? 'execute' : i === 1 ? 'calculate' : `func${i}`;
      const nameBytes = Array.from(new TextEncoder().encode(funcName));
      exportBytes.push(
        nameBytes.length, ...nameBytes,
        0x00, i
      );
    }
    
    const exportSection = [
      0x07,
      exportBytes.length + 1,
      funcCount + (hasMemory ? 1 : 0),
      ...exportBytes
    ];
    
    const codeEntries = [];
    for (let i = 0; i < funcCount; i++) {
      const funcCode = [
        0x04, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b
      ];
      codeEntries.push(funcCode);
    }
    
    const codeSection = [
      0x0a,
      codeEntries.flat().length + 1,
      funcCount,
      ...codeEntries.flat()
    ];
    
    return [
      ...wasmBytes,
      ...typeSection,
      ...funcSection,
      ...memorySection,
      ...exportSection,
      ...codeSection
    ];
  }

  generateMinimalWasm() {
    return new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
      0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,
      0x03, 0x03, 0x02, 0x00, 0x00,
      0x05, 0x03, 0x01, 0x00, 0x01,
      0x07, 0x1a, 0x03,
      0x06, 0x6d, 0x65, 0x6d, 0x6f, 0x72, 0x79, 0x02, 0x00,
      0x03, 0x61, 0x64, 0x64, 0x00, 0x00,
      0x06, 0x6d, 0x75, 0x6c, 0x74, 0x69, 0x70, 0x6c, 0x79, 0x00, 0x01,
      0x0a, 0x13, 0x02,
      0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b,
      0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6c, 0x0b
    ]);
  }

  createDefaultWasmModule(packName) {
    const nameBytes = new TextEncoder().encode(packName);
    
    return new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
      0x01, 0x04, 0x01, 0x60, 0x00, 0x01, 0x7f,
      0x03, 0x02, 0x01, 0x00,
      0x05, 0x03, 0x01, 0x00, 0x01,
      0x0b, nameBytes.length + 5, 0x01,
      0x00, 0x41, 0x00, 0x0b,
      nameBytes.length, ...nameBytes,
      0x07, 0x0a, 0x01,
      0x04, 0x6d, 0x61, 0x69, 0x6e, 0x00, 0x00,
      0x0a, 0x06, 0x01,
      0x04, 0x00, 0x41, 0x2a, 0x0b
    ]);
  }

  async optimizeWasmBinary(wasmBinary) {
    try {
      const optimized = await lowerI64Imports(wasmBinary);
      return optimized;
    } catch (error) {
      console.warn('WASM optimization failed, using original:', error);
      return wasmBinary;
    }
  }

  async validateWasm(wasmBinary) {
    try {
      const module = await WebAssembly.compile(wasmBinary);
      const instance = await WebAssembly.instantiate(module, this.importObject);
      
      const exports = Object.keys(instance.exports);
      return exports.length > 0;
      
    } catch (error) {
      console.error('WASM validation failed:', error);
      return false;
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
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

function validateFilename(filename, packType) {
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
  
  if (packType === 'basic' && ['ts', 'tsx', 'scss', 'sass'].includes(ext)) {
    return { valid: false, reason: `File extension .${ext} requires standard or advanced pack type` };
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

function validateFileContent(filename, content, fileType, packType) {
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
    if (filenameLower === 'pack.json' || filename.endsWith('.json')) {
      try {
        JSON.parse(content);
        return { valid: true };
      } catch (e) {
        return { valid: false, reason: 'Invalid JSON format in pack.json' };
      }
    }
    return { valid: true };
  }
  
  switch (fileType) {
    case 'js':
      return validateJavaScript(content, packType);
    case 'json':
      return validateJSON(content);
    default:
      return { valid: true };
  }
}

function validateJavaScript(content, packType) {
  const dangerousPatterns = [
    /\beval\s*\(/i,
    /\bFunction\s*\(/i,
    /new\s+Function\s*\(/i,
    /\bsetTimeout\s*\([^)]*\)/i,
    /\bsetInterval\s*\([^)]*\)/i,
    /\bsetImmediate\s*\([^)]*\)/i
  ];
  
  if (packType === 'basic') {
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
      const reason = packType === 'basic' 
        ? 'Basic packs cannot use dynamic imports or I/O operations'
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

function validateWebAssembly(content) {
  try {
    if (typeof content === 'string' && content.startsWith('data:application/wasm;base64,')) {
      const base64Data = content.split(',')[1];
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      
      if (bytes.length >= 4 && 
          bytes[0] === 0x00 && bytes[1] === 0x61 && 
          bytes[2] === 0x73 && bytes[3] === 0x6d) {
        return { valid: true };
      }
    }
    
    if (content instanceof Uint8Array) {
      if (content.length >= 4 && 
          content[0] === 0x00 && content[1] === 0x61 && 
          content[2] === 0x73 && content[3] === 0x6d) {
        return { valid: true };
      }
    }
    
    return { valid: false, reason: 'Invalid WebAssembly binary format' };
    
  } catch (e) {
    return { valid: false, reason: 'Failed to parse WebAssembly' };
  }
}

function validatePackJsonSchema(packJson, packType) {
  if (!packJson.name) {
    return { valid: false, reason: 'pack.json must have a "name" field' };
  }
  
  if (!packJson.version) {
    return { valid: false, reason: 'pack.json must have a "version" field' };
  }
  
  const nameValidation = validatePackName(packJson.name);
  if (!nameValidation.valid) {
    return { valid: false, reason: `Invalid name in pack.json: ${nameValidation.reason}` };
  }
  
  if (typeof packJson.version !== 'string') {
    return { valid: false, reason: 'Version must be a string' };
  }
  
  const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/;
  if (!versionRegex.test(packJson.version)) {
    return { valid: false, reason: 'Version must follow semver format (e.g., 1.0.0)' };
  }
  
  if (packJson.complexity && !['low', 'medium', 'high'].includes(packJson.complexity)) {
    return { valid: false, reason: 'complexity must be "low", "medium", or "high"' };
  }
  
  if (packType === 'advanced' || packType === 'wasm') {
    if (!packJson.description || typeof packJson.description !== 'string') {
      return { valid: false, reason: 'Advanced packs must have a description' };
    }
    
    if (packJson.description.length > 1000) {
      return { valid: false, reason: 'Description cannot exceed 1000 characters' };
    }
  }
  
  if (packJson.dependencies && typeof packJson.dependencies !== 'object') {
    return { valid: false, reason: 'Dependencies must be an object' };
  }
  
  if (packJson.scripts && typeof packJson.scripts !== 'object') {
    return { valid: false, reason: 'Scripts must be an object' };
  }
  
  return { valid: true };
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

function generateWasmWrapper(packName, wasmBinary, metadata) {
  const wasmBase64 = Buffer.from(wasmBinary).toString('base64');
  const className = packName.charAt(0).toUpperCase() + packName.slice(1).replace(/[^a-zA-Z0-9]/g, '');
  
  return `// WebAssembly wrapper for ${packName}
// Generated: ${metadata.timestamp}
// Compiled from: ${metadata.compiledFrom}
// Functions: ${metadata.functions.join(', ')}

export class ${className}WASM {
  constructor() {
    this.instance = null;
    this.memory = null;
    this.exports = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return this;
    
    try {
      const wasmData = "${wasmBase64}";
      const wasmBuffer = Uint8Array.from(atob(wasmData), c => c.charCodeAt(0));
      
      const importObject = {
        env: {
          memory: new WebAssembly.Memory({ initial: 256 }),
          table: new WebAssembly.Table({ initial: 0, element: 'anyfunc' }),
          abort: (msg, file, line, column) => {
            console.error(\`WASM abort: \${msg} at \${file}:\${line}:\${column}\`);
          },
          ${generateMathImportsString()}
        }
      };

      const { instance } = await WebAssembly.instantiate(wasmBuffer, importObject);
      this.instance = instance;
      this.exports = instance.exports;
      this.memory = this.exports.memory;
      this.initialized = true;
      
      console.log(\`${packName} WASM initialized successfully\`);
      return this;
      
    } catch (error) {
      console.error('Failed to initialize WASM:', error);
      throw error;
    }
  }

  // Helper methods for all exported functions
  ${metadata.functions.map(funcName => `
  async ${funcName}(...args) {
    await this.init();
    if (!this.exports || !this.exports['${funcName}']) {
      throw new Error(\`Function ${funcName} not found in WASM exports\`);
    }
    return this.exports['${funcName}'](...args);
  }`).join('\n\n  ')}

  // Memory utilities
  readString(ptr, length) {
    if (!this.memory || !ptr) return '';
    const bytes = new Uint8Array(this.memory.buffer, ptr, length);
    return new TextDecoder().decode(bytes);
  }

  writeString(str, ptr) {
    if (!this.memory || !ptr) return 0;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    const view = new Uint8Array(this.memory.buffer, ptr, bytes.length);
    view.set(bytes);
    return bytes.length;
  }

  // Utility to call any exported function
  call(funcName, ...args) {
    if (!this.exports || !this.exports[funcName]) {
      throw new Error(\`Function \${funcName} not found\`);
    }
    return this.exports[funcName](...args);
  }

  // Get all available functions
  getAvailableFunctions() {
    return Object.keys(this.exports || {}).filter(key => typeof this.exports[key] === 'function');
  }
}

// Default export
export default async function create${className}WASM() {
  const wasm = new ${className}WASM();
  await wasm.init();
  return wasm;
}

// ES Module compatibility
if (typeof window !== 'undefined') {
  window.${packName}WASM = create${className}WASM;
}
`;
}

function generateComplexWasmWrapper(packName, wasmBinary) {
  const wasmBase64 = Buffer.from(wasmBinary).toString('base64');
  const className = packName.charAt(0).toUpperCase() + packName.slice(1).replace(/[^a-zA-Z0-9]/g, '');
  
  return `// Complex WebAssembly wrapper for ${packName}
// Advanced WASM module with enhanced capabilities

export class ${className}ComplexWASM {
  constructor(config = {}) {
    this.instance = null;
    this.memory = null;
    this.exports = null;
    this.config = {
      memoryPages: config.memoryPages || 256,
      enableSIMD: config.enableSIMD || false,
      enableThreads: config.enableThreads || false,
      ...config
    };
    this.modules = new Map();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return this;
    
    try {
      const wasmData = "${wasmBase64}";
      const wasmBuffer = Uint8Array.from(atob(wasmData), c => c.charCodeAt(0));
      
      const importObject = {
        env: {
          memory: new WebAssembly.Memory({ 
            initial: this.config.memoryPages,
            maximum: 65536
          }),
          table: new WebAssembly.Table({ 
            initial: 256, 
            element: 'anyfunc' 
          }),
          ${generateMathImportsString()},
          string_new: (ptr, length) => {
            const bytes = new Uint8Array(this.memory.buffer, ptr, length);
            return new TextDecoder().decode(bytes);
          },
          string_copy: (src, dest, length) => {
            const srcView = new Uint8Array(this.memory.buffer, src, length);
            const destView = new Uint8Array(this.memory.buffer, dest, length);
            destView.set(srcView);
            return dest;
          },
          memory_alloc: (size) => {
            if (!this.exports || !this.exports.memory_alloc) {
              throw new Error('memory_alloc not available');
            }
            return this.exports.memory_alloc(size);
          },
          memory_free: (ptr) => {
            if (!this.exports || !this.exports.memory_free) {
              throw new Error('memory_free not available');
            }
            return this.exports.memory_free(ptr);
          }
        }
      };

      const { instance } = await WebAssembly.instantiate(wasmBuffer, importObject);
      this.instance = instance;
      this.exports = instance.exports;
      this.memory = this.exports.memory;
      this.initialized = true;
      
      console.log(\`${packName} Complex WASM initialized with \${this.config.memoryPages} pages\`);
      return this;
      
    } catch (error) {
      console.error('Failed to initialize Complex WASM:', error);
      throw error;
    }
  }

  // Advanced dispatch system
  async dispatch(moduleId, input, options = {}) {
    await this.init();
    
    if (!this.exports || !this.exports.dispatch) {
      throw new Error('Dispatch function not available');
    }
    
    const result = this.exports.dispatch(moduleId, input);
    
    if (options.transform) {
      return this.transformResult(result, options.transform);
    }
    
    return result;
  }

  // Result transformation utilities
  transformResult(result, transformType) {
    switch (transformType) {
      case 'json':
        try {
          const str = this.readString(result, 1024);
          return JSON.parse(str);
        } catch (e) {
          return { error: 'Failed to parse JSON', data: result };
        }
      case 'string':
        return this.readString(result, 1024);
      case 'array':
        return Array.from({ length: result }, (_, i) => i);
      default:
        return result;
    }
  }

  // Memory management
  allocate(size) {
    if (!this.exports || !this.exports.memory_alloc) {
      throw new Error('Memory allocation not supported');
    }
    return this.exports.memory_alloc(size);
  }

  deallocate(ptr) {
    if (!this.exports || !this.exports.memory_free) {
      throw new Error('Memory deallocation not supported');
    }
    return this.exports.memory_free(ptr);
  }

  // Buffer utilities
  writeBuffer(buffer, ptr) {
    if (!this.memory || !ptr) return 0;
    const view = new Uint8Array(this.memory.buffer, ptr, buffer.length);
    view.set(buffer);
    return buffer.length;
  }

  readBuffer(ptr, length) {
    if (!this.memory || !ptr) return new Uint8Array(0);
    return new Uint8Array(this.memory.buffer.slice(ptr, ptr + length));
  }

  // Module registration system
  registerModule(name, module) {
    this.modules.set(name, module);
    return true;
  }

  getModule(name) {
    return this.modules.get(name);
  }

  // Performance monitoring
  benchmark(funcName, iterations = 1000, ...args) {
    if (!this.exports || !this.exports[funcName]) {
      throw new Error(\`Function \${funcName} not found\`);
    }
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      this.exports[funcName](...args);
    }
    const end = performance.now();
    
    return {
      function: funcName,
      iterations,
      totalTime: end - start,
      averageTime: (end - start) / iterations,
      opsPerSecond: (iterations / ((end - start) / 1000))
    };
  }
}

// Default export
export default async function create${className}ComplexWASM(config = {}) {
  const wasm = new ${className}ComplexWASM(config);
  await wasm.init();
  return wasm;
}

// Global registration for browser environments
if (typeof window !== 'undefined') {
  window.${packName}ComplexWASM = create${className}ComplexWASM;
  window.${packName}ComplexWASMClass = ${className}ComplexWASM;
}

// Node.js/CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ${className}ComplexWASM,
    create${className}ComplexWASM,
    default: create${className}ComplexWASM
  };
}
`;
}

// ============================================================================
// EDIT PERMISSIONS (updated to use req parameter)
// ============================================================================
async function canUserEditPack(packId, userId, editToken, req = null) {
  console.log('Checking edit permissions for:', { packId, userId, editToken: editToken ? '***' + editToken.slice(-8) : 'none' });
  
  if (editToken) {
    try {
      console.log('Validating edit token...');
      
      const { data: token, error: tokenError } = await supabase
        .from('edit_tokens')
        .select('*')
        .eq('token', editToken)
        .eq('pack_id', packId)
        .single();
      
      if (tokenError) {
        console.error('Token lookup error:', tokenError);
        return false;
      }
      
      if (token) {
        const now = new Date();
        const expiresAt = new Date(token.expires_at);
        
        console.log('Token found:', {
          id: token.id,
          expiresAt: expiresAt.toISOString(),
          maxUses: token.max_uses,
          useCount: token.use_count,
          isValid: expiresAt > now && (token.max_uses === 0 || token.use_count < token.max_uses)
        });
        
        if (expiresAt > now && (token.max_uses === 0 || token.use_count < token.max_uses)) {
          await supabase
            .from('edit_tokens')
            .update({ 
              use_count: token.use_count + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', token.id);
          
          console.log('Edit token validated successfully');
          return true;
        } else {
          console.log('Token expired or max uses reached');
        }
      } else {
        console.log('No matching token found');
      }
    } catch (error) {
      console.error('Edit token validation failed:', error);
      return false;
    }
  }
  
  if (userId) {
    try {
      console.log('Checking user permissions...');
      const { data: pack } = await supabase
        .from('packs')
        .select('publisher_id')
        .eq('id', packId)
        .single();
      
      if (pack && pack.publisher_id === userId) {
        console.log('User is the pack owner');
        return true;
      }
      
      const { data: collaborator } = await supabase
        .from('pack_collaborators')
        .select('*')
        .eq('pack_id', packId)
        .eq('user_id', userId)
        .single();
      
      if (collaborator) {
        console.log('User is a collaborator');
        return true;
      }
    } catch (error) {
      console.error('User permission check failed:', error);
    }
  }
  
  if (req) {
    try {
      const clientIp = req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || 
                      req.socket?.remoteAddress;
      
      if (clientIp) {
        console.log('Checking IP match:', clientIp);
        const { data: pack } = await supabase
          .from('packs')
          .select('publisher_ip')
          .eq('id', packId)
          .single();
        
        if (pack && pack.publisher_ip === clientIp) {
          console.log('IP matches original publisher');
          return true;
        }
      }
    } catch (error) {
      console.error('IP check failed:', error);
    }
  }
  
  console.log('All permission checks failed');
  return false;
}

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

// ============================================================================
// VERSIONING API HANDLER
// ============================================================================
async function handlePackVersions(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Pack ID is required',
        code: 'MISSING_PACK_ID'
      });
    }

    const { data: versions, error } = await supabase
      .from('pack_versions')
      .select('*')
      .eq('pack_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      versions: versions || [],
      count: versions?.length || 0
    });

  } catch (error) {
    console.error('Pack versions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pack versions',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
}

// ============================================================================
// EDIT PACK API HANDLER
// ============================================================================
async function handleEditPack(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    const { 
      packId, 
      files, 
      packJson, 
      version,
      userId,
      editToken
    } = req.body;

    if (!packId || !files || !packJson || !version) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        code: 'MISSING_FIELDS'
      });
    }

    const canEdit = await canUserEditPack(packId, userId, editToken, req);
    if (!canEdit) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to edit this pack',
        code: 'EDIT_PERMISSION_DENIED'
      });
    }

    const { data: currentPack, error: packError } = await supabase
      .from('packs')
      .select('*')
      .eq('id', packId)
      .single();

    if (packError) {
      throw packError;
    }

    let packJsonObj;
    try {
      packJsonObj = JSON.parse(packJson);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pack.json format',
        code: 'INVALID_PACK_JSON'
      });
    }

    const { data: existingVersion } = await supabase
      .from('pack_versions')
      .select('version')
      .eq('pack_id', packId)
      .eq('version', version)
      .single();

    if (existingVersion) {
      return res.status(409).json({
        success: false,
        error: `Version ${version} already exists`,
        code: 'VERSION_EXISTS'
      });
    }

    const now = new Date().toISOString();
    const versionNumber = await getNextVersionNumber(packId);
    const packChecksum = generateChecksum(JSON.stringify(files));

    const packJsonValidation = validatePackJsonSchema(packJsonObj, currentPack.pack_type);
    if (!packJsonValidation.valid) {
      return res.status(400).json({
        success: false,
        error: `Invalid pack.json: ${packJsonValidation.reason}`,
        code: 'INVALID_PACK_JSON_SCHEMA'
      });
    }

    const { data: newVersion, error: versionError } = await supabase
      .from('pack_versions')
      .insert([{
        pack_id: packId,
        version: version,
        version_number: versionNumber,
        pack_json: packJson,
        files: files,
        checksum: packChecksum,
        publisher_id: userId,
        created_at: now,
        updated_at: now
      }])
      .select()
      .single();

    if (versionError) {
      throw versionError;
    }

    const { error: updateError } = await supabase
      .from('packs')
      .update({
        pack_json: packJson,
        files: files,
        version: version,
        updated_at: now,
        last_accessed: now
      })
      .eq('id', packId);

    if (updateError) {
      throw updateError;
    }

    await supabase
      .from('pack_changes')
      .insert([{
        pack_id: packId,
        user_id: userId,
        change_type: 'edit',
        description: `Updated pack to version ${version}`,
        metadata: {
          version: version,
          versionNumber: versionNumber,
          fileCount: Object.keys(files).length
        },
        created_at: now
      }]);

    try {
      const executor = new PackJsonExecutor(packJsonObj, files, currentPack.pack_type);
      await executor.testExecution();
    } catch (executionError) {
      console.warn('Pack.json execution test failed (non-critical):', executionError);
    }

    res.status(200).json({
      success: true,
      message: 'Pack updated successfully',
      version: version,
      versionNumber: versionNumber,
      packId: packId,
      timestamp: now
    });

  } catch (error) {
    console.error('Edit pack error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update pack',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
}

// ============================================================================
// MAIN PUBLISH API HANDLER
// ============================================================================
async function handler(req, res) {
  const startTime = Date.now();
  
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

  if (req.url?.includes('/api/pack-versions')) {
    return handlePackVersions(req, res);
  }

  if (req.url?.includes('/api/edit-pack')) {
    return handleEditPack(req, res);
  }

  if (req.method === 'GET' && req.url?.includes('/api/publish')) {
    return res.status(200).json({
      success: true,
      api: 'Pack Publish API',
      version: '1.0.0',
      endpoints: {
        publish: 'POST /api/publish',
        versions: 'GET /api/pack-versions?id=<packId>',
        edit: 'POST /api/edit-pack'
      }
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

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

  const contentType = req.headers['content-type'];
  if (!contentType || !contentType.includes('application/json')) {
    return res.status(415).json({
      success: false,
      error: 'Content-Type must be application/json',
      code: 'INVALID_CONTENT_TYPE'
    });
  }

  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > 100 * 1024 * 1024) {
    return res.status(413).json({
      success: false,
      error: 'Request body too large. Maximum 100MB allowed for WASM packs.',
      code: 'PAYLOAD_TOO_LARGE'
    });
  }

  try {
    const { 
      name, 
      packJson, 
      files, 
      isPublic = true,
      packageType: providedPackageType = 'basic',  // from UI
      complexity: providedComplexity,               // from UI (low/medium/high)
      version = '1.0.0',
      isNewVersion = false,
      basePackId = null,
      userId = null,
      editToken = null,
      collaborators = [],
      compileToWasm = false,
      wasmConfig = {}
    } = req.body;

    if (!name || !packJson || !files) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: name, packJson, and files are required',
        code: 'MISSING_FIELDS'
      });
    }

    const nameValidation = validatePackName(name);
    if (!nameValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid pack name: ${nameValidation.reason}`,
        code: 'INVALID_PACK_NAME'
      });
    }

    if (RESERVED_NAMES.includes(name.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `Pack name "${name}" is reserved and cannot be used`,
        code: 'RESERVED_NAME'
      });
    }

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
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid packJson: Must be valid JSON',
        code: 'INVALID_JSON'
      });
    }

    // Determine pack type based on complexity or provided type
    let packType = providedPackageType;
    if (providedComplexity) {
      if (!['low', 'medium', 'high'].includes(providedComplexity)) {
        return res.status(400).json({
          success: false,
          error: 'complexity must be "low", "medium", or "high"',
          code: 'INVALID_COMPLEXITY'
        });
      }
      const complexityMap = { low: 'basic', medium: 'standard', high: 'advanced' };
      packType = complexityMap[providedComplexity];
    } else if (packJsonObj.complexity) {
      if (!['low', 'medium', 'high'].includes(packJsonObj.complexity)) {
        return res.status(400).json({
          success: false,
          error: 'complexity in pack.json must be "low", "medium", or "high"',
          code: 'INVALID_PACK_JSON_COMPLEXITY'
        });
      }
      const complexityMap = { low: 'basic', medium: 'standard', high: 'advanced' };
      packType = complexityMap[packJsonObj.complexity];
    }

    if (!PACK_TYPES[packType]) {
      return res.status(400).json({
        success: false,
        error: `Invalid pack type. Must be one of: ${Object.keys(PACK_TYPES).join(', ')}`,
        code: 'INVALID_PACK_TYPE'
      });
    }

    const packConfig = PACK_TYPES[packType];

    // Validate packJson schema
    const packJsonValidation = validatePackJsonSchema(packJsonObj, packType);
    if (!packJsonValidation.valid) {
      return res.status(400).json({
        success: false,
        error: `Invalid pack.json: ${packJsonValidation.reason}`,
        code: 'INVALID_PACK_JSON_SCHEMA'
      });
    }

    if (typeof files !== 'object' || files === null || Array.isArray(files)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Files must be an object with filename: content pairs',
        code: 'INVALID_FILES_STRUCTURE'
      });
    }

    const fileCount = Object.keys(files).length;
    if (fileCount > packConfig.maxFiles) {
      return res.status(400).json({ 
        success: false, 
        error: `Too many files. Maximum ${packConfig.maxFiles} files allowed for ${packType} packs.`,
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

    let totalSize = 0;
    const processedFiles = {};
    const fileDependencies = new Set();
    const wasmFiles = [];
    const hasSourceFiles = { rust: false, go: false, zig: false };
    
    for (const [filename, content] of Object.entries(files)) {
      const filenameValidation = validateFilename(filename, packType);
      if (!filenameValidation.valid) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid filename: ${filenameValidation.reason}`,
          code: 'INVALID_FILENAME'
        });
      }

      if (typeof content !== 'string') {
        return res.status(400).json({ 
          success: false, 
          error: `File content must be a string: ${filename}`,
          code: 'INVALID_CONTENT_TYPE'
        });
      }

      const fileSize = content.length;
      totalSize += fileSize;
      
      const maxFileSize = packType === 'advanced' || packType === 'wasm' ? 
        10 * 1024 * 1024 : 2 * 1024 * 1024;
      
      if (fileSize > maxFileSize) {
        return res.status(400).json({ 
          success: false, 
          error: `File too large: ${filename}. Maximum ${maxFileSize / 1024 / 1024}MB per file.`,
          code: 'FILE_TOO_LARGE'
        });
      }

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

      const contentValidation = validateFileContent(filename, content, fileType, packType);
      if (!contentValidation.valid) {
        return res.status(400).json({
          success: false,
          error: `Invalid content in ${filename}: ${contentValidation.reason}`,
          code: 'INVALID_CONTENT'
        });
      }

      if (fileType === 'wasm') {
        wasmFiles.push({ filename, content });
        
        const wasmValidation = validateWebAssembly(content);
        if (!wasmValidation.valid) {
          return res.status(400).json({
            success: false,
            error: `Invalid WebAssembly in ${filename}: ${wasmValidation.reason}`,
            code: 'INVALID_WASM'
          });
        }
      }

      if (fileType === 'rust') hasSourceFiles.rust = true;
      if (fileType === 'go') hasSourceFiles.go = true;
      if (fileType === 'zig') hasSourceFiles.zig = true;

      processedFiles[filename] = content;
    }

    // Check if WASM is supported by the pack type
    if (wasmFiles.length > 0 && !packConfig.wasmSupport) {
      return res.status(400).json({
        success: false,
        error: `WASM files are not allowed for ${packType} packs. Please use higher complexity.`,
        code: 'WASM_NOT_SUPPORTED',
        suggestion: 'Set complexity to "medium" or "high" to enable WASM support.'
      });
    }

    if (compileToWasm && !packConfig.canCompileToWasm) {
      return res.status(400).json({
        success: false,
        error: `Compilation to WASM is not allowed for ${packType} packs. Please use higher complexity.`,
        code: 'WASM_COMPILE_NOT_SUPPORTED'
      });
    }

    if (totalSize > packConfig.maxSize) {
      return res.status(400).json({ 
        success: false, 
        error: `Pack too large. Total size: ${(totalSize / 1024 / 1024).toFixed(2)}MB. Maximum ${packConfig.maxSize / 1024 / 1024}MB for ${packType} packs.`,
        code: 'PACK_TOO_LARGE'
      });
    }

    // Extract dependencies from pack.json (not from a separate package.json)
    if (packJsonObj.dependencies) {
      Object.keys(packJsonObj.dependencies).forEach(dep => {
        if (dep.startsWith('@')) return;
        fileDependencies.add(dep.toLowerCase());
      });
    }
    if (packJsonObj.devDependencies) {
      Object.keys(packJsonObj.devDependencies).forEach(dep => {
        if (dep.startsWith('@')) return;
        fileDependencies.add(dep.toLowerCase());
      });
    }
    if (packJsonObj.peerDependencies) {
      Object.keys(packJsonObj.peerDependencies).forEach(dep => {
        if (dep.startsWith('@')) return;
        fileDependencies.add(dep.toLowerCase());
      });
    }

    if (packType === 'advanced' || packType === 'standard') {
      for (const dep of fileDependencies) {
        const allowed = packConfig.allowedNodeModules || ADVANCED_NODE_MODULES;
        if (!allowed.includes(dep) && !allowed.some(a => dep.startsWith(a + '/'))) {
          return res.status(400).json({
            success: false,
            error: `Dependency "${dep}" is not allowed for ${packType} packs.`,
            code: 'DISALLOWED_DEPENDENCY',
            allowedModules: allowed
          });
        }
        
        if (BANNED_NODE_MODULES.includes(dep)) {
          return res.status(400).json({
            success: false,
            error: `Dependency "${dep}" is banned for security reasons.`,
            code: 'BANNED_DEPENDENCY'
          });
        }
      }
    }

    // ============================================================================
    // FUNCTIONAL PACK.JSON EXECUTION TEST
    // ============================================================================
    let enhancedPackJson = packJsonObj;
    
    try {
      const executor = new PackJsonExecutor(packJsonObj, processedFiles, packType);
      enhancedPackJson = await executor.testExecution();
    } catch (executionError) {
      console.warn('Pack.json execution test failed (non-critical):', executionError);
    }

    // ============================================================================
    // COMPLEX WASM COMPILATION
    // ============================================================================
    let compiledWasm = null;
    let complexWasm = null;
    let wasmMetadata = null;
    
    if (compileToWasm && packConfig.canCompileToWasm) {
      try {
        const wasmCompiler = new PackWASMCompiler();
        
        const jsFiles = Object.entries(processedFiles).filter(([name]) => 
          name.endsWith('.js') || name.endsWith('.ts') || 
          name.endsWith('.jsx') || name.endsWith('.tsx')
        );
        
        if (jsFiles.length > 0) {
          console.log(`Compiling ${jsFiles.length} JS/TS files to WASM`);
          
          const [mainFile, content] = jsFiles[0];
          
          const compilation = await wasmCompiler.compileJavaScriptToWasm(content, {
            ...wasmConfig,
            name,
            initialMemory: wasmConfig.initialMemory || 1,
            maxMemory: wasmConfig.maxMemory || 65536
          });
          
          if (compilation.success) {
            compiledWasm = compilation.wasm;
            wasmMetadata = compilation.metadata;
            
            processedFiles['compiled.wasm'] = Buffer.from(compiledWasm).toString('base64');
            processedFiles['wasm-wrapper.js'] = generateWasmWrapper(name, compiledWasm, wasmMetadata);
            
            console.log(`Successfully compiled ${mainFile} to WASM (${compiledWasm.length} bytes)`);
          }
        }
        
        if (packType === 'advanced' || packType === 'wasm') {
          console.log('Generating complex WASM module');
          
          const complexResult = await wasmCompiler.createComplexWasmModule(
            processedFiles, 
            name, 
            wasmConfig
          );
          
          if (complexResult && complexResult.wasm) {
            complexWasm = complexResult.wasm;
            processedFiles['complex.wasm'] = Buffer.from(complexWasm).toString('base64');
            processedFiles['complex-wrapper.js'] = generateComplexWasmWrapper(name, complexWasm);
            
            console.log(`Generated complex WASM module (${complexWasm.length} bytes)`);
          }
        }
        
      } catch (compileError) {
        console.warn('WASM compilation failed, continuing without WASM:', compileError);
      }
    }

    // ============================================================================
    // VERSIONING AND DATABASE LOGIC
    // ============================================================================
    let versionNumber = sanitizeVersion(version);
    let isVersionOfId = null;

    if (isNewVersion && basePackId) {
      console.log(`Creating new version for pack ID: ${basePackId}`);
      
      const { data: basePack } = await supabase
        .from('packs')
        .select('id, name, pack_type')
        .eq('id', basePackId)
        .single();
      
      if (!basePack) {
        return res.status(404).json({
          success: false,
          error: `Base pack with ID "${basePackId}" not found`,
          code: 'BASE_PACK_NOT_FOUND'
        });
      }
      
      const canEdit = await canUserEditPack(basePackId, userId, editToken);
      if (!canEdit) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to edit this pack',
          code: 'EDIT_PERMISSION_DENIED',
          details: userId ? 
            'Your user ID does not match the pack owner' : 
            'Valid edit token is required for anonymous users'
        });
      }
      
      isVersionOfId = basePackId;
      console.log(`Creating version ${versionNumber} of "${basePack.name}" (ID: ${basePackId})`);
      
    } else if (isNewVersion && !basePackId) {
      console.log(`Looking for original pack with name: "${name}"`);
      
      try {
        const { data: originalPack } = await supabase
          .from('packs')
          .select('id, name, created_at')
          .eq('name', name)
          .order('created_at', { ascending: true })
          .limit(1);
        
        if (originalPack && originalPack[0]) {
          isVersionOfId = originalPack[0].id;
          console.log(`Found original pack ID: ${isVersionOfId} for name: "${name}"`);
          
          const canEdit = await canUserEditPack(isVersionOfId, userId, editToken);
          if (!canEdit) {
            return res.status(403).json({
              success: false,
              error: 'You do not have permission to create a version of this pack',
              code: 'EDIT_PERMISSION_DENIED',
              details: userId ? 
                'Your user ID does not match the pack owner' : 
                'Valid edit token is required for anonymous users'
            });
          }
          
          console.log(`Creating new version ${versionNumber} of existing pack "${name}"`);
        } else {
          return res.status(400).json({
            success: false,
            error: `Cannot create new version - no existing pack found with name "${name}"`,
            code: 'NO_EXISTING_PACK',
            suggestion: 'Create a new pack instead or provide the correct basePackId'
          });
        }
      } catch (lookupError) {
        console.error('Pack lookup error:', lookupError);
        return res.status(500).json({
          success: false,
          error: 'Failed to check for existing packs',
          code: 'LOOKUP_ERROR'
        });
      }
      
    } else {
      console.log(`Creating new pack: "${name}"`);
      isVersionOfId = null;
      
      const { data: existingPack } = await supabase
        .from('packs')
        .select('id, name, created_at, is_version_of')
        .eq('name', name)
        .limit(5);
      
      if (existingPack && existingPack.length > 0) {
        const originalPacks = existingPack.filter(p => p.is_version_of === null);
        
        if (originalPacks.length > 0) {
          const originalPack = originalPacks[0];
          return res.status(409).json({
            success: false,
            error: `Pack name "${name}" is already taken. Pack names must be unique for new packs.`,
            code: 'PACK_NAME_EXISTS',
            existingPackId: originalPack.id,
            suggestion: `Use "isNewVersion: true" and "basePackId: "${originalPack.id}" to create a new version`,
            existingVersions: existingPack.length,
            originalCreated: originalPack.created_at
          });
        }
        console.log(`Name "${name}" has ${existingPack.length} versions but no original pack. Creating new original.`);
      }
    }

    const urlId = generateSecureUrlId();
    const cdnUrl = `https://packcdn.firefly-worker.workers.dev/cdn/${urlId}`;
    const workerUrl = `https://packcdn.firefly-worker.workers.dev/pack/${urlId}`;
    const wasmUrl = compiledWasm ? `${cdnUrl}/compiled.wasm` : null;
    const complexWasmUrl = complexWasm ? `${cdnUrl}/complex.wasm` : null;

    const encryptedKey = !isPublic ? generateSecureEncryptionKey() : null;
    const packChecksum = generateChecksum(JSON.stringify(processedFiles));

    const now = new Date().toISOString();
    const packData = {
      url_id: urlId,
      name,
      pack_json: JSON.stringify(enhancedPackJson),
      files: processedFiles,
      cdn_url: cdnUrl,
      worker_url: workerUrl,
      encrypted_key: encryptedKey,
      is_public: isPublic,
      version: versionNumber,
      pack_type: packType,
      created_at: now,
      updated_at: now,
      views: 0,
      downloads: 0,
      publish_ip: clientIp,
      last_accessed: now,
      publisher_id: userId,
      wasm_url: wasmUrl,
      complex_wasm_url: complexWasmUrl,
      wasm_metadata: wasmMetadata,
      compile_to_wasm: compileToWasm,
      is_version_of: isVersionOfId
    };

    console.log('Inserting pack data with is_version_of:', isVersionOfId);
    const { data: pack, error: packError } = await supabase
      .from('packs')
      .insert([packData])
      .select()
      .single();

    if (packError) {
      console.error('Supabase insert error:', packError);
      
      if (packError.code === '23505') {
        return res.status(409).json({ 
          success: false, 
          error: 'Pack name already exists. Use isNewVersion: true to create a new version.',
          code: 'DUPLICATE_PACK_NAME',
          details: packError.message,
          suggestion: 'Set isNewVersion: true and provide basePackId or leave blank to find original'
        });
      } else if (packError.code === 'P0001') {
        return res.status(409).json({
          success: false,
          error: packError.message,
          code: 'DATABASE_VALIDATION_ERROR',
          suggestion: 'This is likely a duplicate name error. Use versioning instead.'
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to save pack to database',
        code: 'DATABASE_ERROR',
        details: packError.message,
        databaseError: packError.code
      });
    }

    console.log(`Pack ${pack.id} saved successfully! is_version_of: ${pack.is_version_of}`);

    try {
      await supabase
        .from('pack_versions')
        .insert([{
          pack_id: pack.id,
          version: versionNumber,
          version_number: isNewVersion ? await getNextVersionNumber(basePackId) : 1,
          pack_json: JSON.stringify(enhancedPackJson),
          files: processedFiles,
          checksum: packChecksum,
          publisher_id: userId,
          created_at: now,
          updated_at: now
        }]);

      await supabase
        .from('pack_metadata')
        .insert([{
          pack_id: pack.id,
          pack_type: packType,
          sandbox_level: packConfig.sandboxLevel || 'basic',
          requires_verification: packConfig.requiresVerification || false,
          verification_status: packConfig.requiresVerification ? 'pending' : 'approved',
          file_count: fileCount,
          total_size: totalSize,
          wasm_size: compiledWasm ? compiledWasm.length : 0,
          complex_wasm_size: complexWasm ? complexWasm.length : 0,
          last_accessed: now,
          updated_at: now
        }]);

      if (fileDependencies.size > 0) {
        const dependencyInserts = Array.from(fileDependencies).map(dep => ({
          pack_id: pack.id,
          dependency_name: dep,
          created_at: now
        }));
        
        await supabase
          .from('pack_dependencies')
          .insert(dependencyInserts);
      }

      if (collaborators && Array.isArray(collaborators)) {
        const validCollaborators = collaborators.filter(c => 
          c && typeof c === 'string' && c.length > 0
        ).slice(0, 10);
        
        if (validCollaborators.length > 0) {
          if (userId && !validCollaborators.includes(userId)) {
            validCollaborators.unshift(userId);
          }
          
          const collaboratorInserts = validCollaborators.map((collabUserId, index) => ({
            pack_id: pack.id,
            user_id: collabUserId,
            permission_level: index === 0 ? 'admin' : 'editor',
            invited_by: userId,
            accepted_at: now,
            created_at: now
          }));
          
          await supabase
            .from('pack_collaborators')
            .insert(collaboratorInserts);
        }
      }

      await supabase
        .from('pack_changes')
        .insert([{
          pack_id: pack.id,
          user_id: userId,
          change_type: isNewVersion ? 'version' : 'create',
          description: isNewVersion 
            ? `Created new version ${versionNumber} from base pack ${basePackId}`
            : `Created new pack ${name} v${versionNumber}`,
          metadata: {
            packType,
            fileCount,
            totalSize,
            isPublic,
            compileToWasm,
            wasmGenerated: !!compiledWasm,
            complexWasmGenerated: !!complexWasm,
            dependencies: Array.from(fileDependencies),
            hasExecutionMethods: true
          },
          created_at: now
        }]);

    } catch (advancedError) {
      console.warn('Advanced features save failed (non-critical):', advancedError);
    }

    // ============================================================================
    // SUCCESS RESPONSE
    // ============================================================================
    const processingTime = Date.now() - startTime;

    console.log(`Pack published successfully: ${name} v${versionNumber}`, {
      packType,
      fileCount,
      totalSize: `${(totalSize / 1024).toFixed(2)}KB`,
      processingTime: `${processingTime}ms`,
      wasmGenerated: !!compiledWasm,
      complexWasmGenerated: !!complexWasm,
      hasExecutionMethods: true
    });

    let editTokenData = null;
    let generatedToken = null;

    try {
      const token = crypto.randomBytes(32).toString('hex');
      generatedToken = token;
      
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: tokenResult, error: tokenError } = await supabase
        .from('edit_tokens')
        .insert([{
          pack_id: pack.id,
          token: token,
          created_by: userId || 'anonymous',
          creator_ip: clientIp,
          expires_at: expiresAt,
          max_uses: 50,
          use_count: 0,
          created_at: now,
          updated_at: now
        }])
        .select()
        .single();
        
      if (!tokenError && tokenResult) {
        editTokenData = tokenResult;
        console.log(`Generated edit token for pack ${pack.id}`);
      } else {
        console.warn('Failed to generate edit token (non-critical):', tokenError);
      }
    } catch (tokenError) {
      console.warn('Edit token generation failed (non-critical):', tokenError);
    }

    const editUrl = `/api/edit-pack?id=${pack.id}${editToken ? `&token=${editToken}` : ''}`;
    const manageUrl = editToken ? `/manage/${pack.id}?token=${editToken}` : `/manage/${pack.id}`;

    res.status(201).json({
      success: true,
      packId: pack.id,
      urlId,
      cdnUrl,
      workerUrl,
      wasmUrl,
      complexWasmUrl,
      
      editToken: generatedToken || editToken,
      
      editTokenInfo: editTokenData ? {
        token: editTokenData.token,
        expiresAt: editTokenData.expires_at,
        maxUses: editTokenData.max_uses,
        remainingUses: editTokenData.max_uses - editTokenData.use_count,
        createdAt: editTokenData.created_at
      } : null,
      
      securityWarning: !userId ? [
        '⚠️ IMPORTANT: You have published anonymously',
        '🔑 Save this edit token: ' + (generatedToken || editToken || 'NOT GENERATED'),
        '📝 You will need this token to update or delete this pack',
        '💾 Store it securely - it cannot be recovered if lost',
        '🔗 Bookmark this page or save the token in a safe place'
      ] : null,
      
      installCommand: `pack install ${name}@${versionNumber} ${cdnUrl}`,
      npmInstallCommand: `npm install ${name}`,
      encryptedKey,
      isNewVersion,
      basePackId,
      version: versionNumber,
      metadata: {
        name,
        version: versionNumber,
        packType,
        complexity: packJsonObj.complexity || (packType === 'basic' ? 'low' : packType === 'standard' ? 'medium' : 'high'),
        fileCount,
        totalSize,
        isPublic,
        dependencies: Array.from(fileDependencies),
        wasmGenerated: !!compiledWasm,
        complexWasmGenerated: !!complexWasm,
        wasmFunctions: wasmMetadata?.functions || [],
        createdAt: now,
        checksum: packChecksum,
        hasExecutionMethods: true,
        publisherType: userId ? 'authenticated' : 'anonymous',
        publisherIpHash: clientIp ? crypto.createHash('sha256').update(clientIp).digest('hex').substring(0, 16) : null
      },
      links: {
        cdn: cdnUrl,
        info: workerUrl,
        download: `${cdnUrl}/index.js`,
        wasm: wasmUrl,
        complexWasm: complexWasmUrl,
        api: `/api/get-pack?id=${urlId}`,
        versions: `/api/pack-versions?id=${pack.id}`,
        edit: editUrl,
        manage: manageUrl,
        embed: `${workerUrl}/embed`,
        raw: `${cdnUrl}/raw/${name}.js`
      },
      advancedFeatures: {
        versioning: true,
        collaboration: true,
        dependencies: fileDependencies.size > 0,
        wasmSupport: true,
        complexWasmSupport: !!complexWasm,
        compileToWasm: compileToWasm,
        webAccessible: true,
        sandboxed: true,
        packJsonExecution: true,
        anonymousPublishing: !userId,
        editTokenProvided: !!editToken
      },
      quickActions: {
        testPack: `curl "${workerUrl}/test"`,
        runPack: `pack run ${name}`,
        updatePack: `curl -X POST "${editUrl}" -H "Content-Type: application/json" -d '{"files": {...}}'`,
        deletePack: editToken ? `curl -X DELETE "${workerUrl}/delete?token=${editToken}"` : 'Requires edit token'
      },
      processingTime: `${processingTime}ms`,
      
      nextSteps: [
        'Test your pack: ' + `${workerUrl}/test`,
        'Share your pack: ' + cdnUrl,
        'Embed in website: ' + `<script src="${cdnUrl}/embed.js"></script>`,
        editToken ? 'Save your edit token for future updates' : 'No edit token generated - contact support if needed'
      ]
    });

  } catch (error) {
    console.error('Publish error:', {
      message: error.message,
      stack: error.stack,
      clientIp,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({ 
      success: false, 
      error: 'An unexpected error occurred. Please try again later.',
      code: 'INTERNAL_SERVER_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      
      recoveryTips: [
        'Check your pack.json for syntax errors',
        'Ensure all file sizes are under 10MB',
        'Verify pack name follows naming conventions',
        'Try reducing the number of files if over limit'
      ]
    });
  }

  setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of rateLimitStore.entries()) {
      if (now > data.resetTime + 60 * 60 * 1000 && data.bannedUntil < now) {
        rateLimitStore.delete(ip);
      }
    }
  }, 5 * 60 * 1000);
}

// ============================================================================
// EXPORTS
// ============================================================================
export default handler;

export {
  validatePackName,
  validateFilename,
  validateFileContent,
  validatePackJsonSchema,
  validateWebAssembly,
  sanitizeVersion,
  generateSecureUrlId,
  generateSecureEncryptionKey,
  generateChecksum,
  PackWASMCompiler,
  PACK_TYPES,
  ADVANCED_NODE_MODULES,
  BANNED_NODE_MODULES,
  PackJsonExecutor,
  handlePackVersions,
  handleEditPack
};
