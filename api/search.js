// /api/search.js - Enhanced for full compatibility with pack.json and new database schema
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Search scoring weights
const SEARCH_WEIGHTS = {
  NAME_EXACT_MATCH: 15,
  NAME_PARTIAL_MATCH: 10,
  DESCRIPTION_MATCH: 6,
  KEYWORD_EXACT_MATCH: 5,
  KEYWORD_PARTIAL_MATCH: 3,
  AUTHOR_MATCH: 4,
  POPULARITY: 2,
  RECENCY: 1.5,
  VERIFICATION_BOOST: 8,
  RECENT_ACTIVITY: 3,
  WASM_SUPPORT: 5
};

// Available filters
const AVAILABLE_FILTERS = {
  type: ['basic', 'standard', 'advanced', 'wasm'],
  language: ['javascript', 'typescript', 'python', 'wasm', 'rust', 'go', 'zig', 'json', 'html', 'css', 'mixed'],
  minVersion: null,
  maxVersion: null,
  minSize: null,
  maxSize: null,
  hasReadme: null,
  hasLicense: null,
  hasTests: null,
  verified: ['pending', 'approved', 'rejected'],
  dependency: null,
  author: null,
  minDownloads: null,
  minViews: null,
  compileToWasm: null,
  wasmGenerated: null,
  complexWasm: null,
  sandboxLevel: ['strict', 'moderate', 'relaxed', 'wasm-sandbox'],
  sort: ['relevance', 'popular', 'newest', 'updated', 'name', 'trending', 'most-viewed']
};

// Enhanced handler
export default async function handler(req, res) {
  // Enhanced CORS
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://pack-cdn.vercel.app',
    'https://pack-dash.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    // Extract query parameters
    const { 
      q, 
      type, 
      language,
      minVersion,
      maxVersion,
      minSize,
      maxSize,
      hasReadme,
      hasLicense,
      hasTests,
      verified,
      dependency,
      author,
      minDownloads = 0,
      minViews = 0,
      compileToWasm,
      wasmGenerated,
      complexWasm,
      sandboxLevel,
      sort = 'relevance',
      page = 1,
      limit = 20,
      includeMetadata = 'true',
      advanced = 'false',
      includeAllTables = 'false'
    } = req.query;

    // Parse numeric parameters
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;
    const useAdvancedSearch = advanced === 'true';
    const includeAllData = includeAllTables === 'true';

    console.log(`Search query: ${q || '(none)'}, Page: ${pageNum}, Limit: ${limitNum}, Advanced: ${useAdvancedSearch}`);

    // Build base query - only original packages (is_version_of IS NULL)
    let query = supabase
      .from('packs')
      .select(`
        *,
        pack_metadata (
          package_type,
          sandbox_level,
          verification_status,
          requires_verification,
          file_count,
          total_size,
          wasm_size,
          complex_wasm_size,
          last_accessed
        )
      `, { count: 'exact' })
      .eq('is_public', true)
      .is('is_version_of', null);  // Only original packages, not versions

    // Apply search query
    if (q) {
      const searchTerms = q.toLowerCase().trim().split(/\s+/);
      
      // Build complex search conditions
      let searchConditions = [];
      
      searchTerms.forEach(term => {
        if (term.length >= 2) {
          searchConditions.push(
            `name.ilike.%${term}%`,
            `pack_json->>'description'.ilike.%${term}%`,
            `pack_json->>'keywords'.ilike.%${term}%`,
            `pack_json->>'author'.ilike.%${term}%`
          );
        }
      });
      
      if (searchConditions.length > 0) {
        query = query.or(searchConditions.join(','));
      }
    }

    // Apply package type filter - using new pack_type column
    if (type && ['basic', 'standard', 'advanced', 'wasm'].includes(type)) {
      query = query.eq('pack_type', type);
    }

    // Apply version filters
    if (minVersion) {
      query = query.gte('version', minVersion);
    }
    if (maxVersion) {
      query = query.lte('version', maxVersion);
    }

    // Apply boolean filters
    if (hasReadme === 'true') {
      query = query.or(`
        name.ilike.%readme%,
        pack_json->>'description'.ilike.%readme%,
        pack_json->>'keywords'.ilike.%readme%
      `);
    }
    
    if (hasLicense === 'true') {
      query = query.or(`
        pack_json->>'license'.not.is.null,
        name.ilike.%license%
      `);
    }
    
    if (hasTests === 'true') {
      query = query.or(`
        name.ilike.%test%,
        name.ilike.%spec%,
        pack_json->>'keywords'.ilike.%test%
      `);
    }

    // Apply WASM-related filters using new columns
    if (compileToWasm === 'true') {
      query = query.eq('compile_to_wasm', true);
    } else if (compileToWasm === 'false') {
      query = query.eq('compile_to_wasm', false);
    }
    
    if (wasmGenerated === 'true') {
      query = query.not('wasm_url', 'is', null);
    } else if (wasmGenerated === 'false') {
      query = query.is('wasm_url', null);
    }
    
    if (complexWasm === 'true') {
      query = query.not('complex_wasm_url', 'is', null);
    } else if (complexWasm === 'false') {
      query = query.is('complex_wasm_url', null);
    }

    // Apply author/publisher filter
    if (author) {
      query = query.or(`
        pack_json->>'author'.ilike.%${author}%,
        publisher_id.ilike.%${author}%
      `);
    }

    // Apply popularity filters
    if (parseInt(minDownloads) > 0) {
      query = query.gte('downloads', parseInt(minDownloads));
    }
    
    if (parseInt(minViews) > 0) {
      query = query.gte('views', parseInt(minViews));
    }

    // Apply sorting
    switch (sort) {
      case 'popular':
        query = query.order('downloads', { ascending: false });
        break;
      case 'most-viewed':
        query = query.order('views', { ascending: false });
        break;
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'updated':
        query = query.order('updated_at', { ascending: false });
        break;
      case 'name':
        query = query.order('name', { ascending: true });
        break;
      case 'trending':
        // Trending: recent popularity (downloads per day)
        query = query.order('created_at', { ascending: false });
        break;
      case 'relevance':
      default:
        if (q) {
          query = query.order('downloads', { ascending: false });
        } else {
          query = query.order('created_at', { ascending: false });
        }
        break;
    }

    // Get count and results
    const { data: packs, count, error } = await query.range(offset, offset + limitNum - 1);
    
    if (error) {
      console.error('Search query error:', error);
      throw error;
    }

    // Early return if no packs
    if (!packs || packs.length === 0) {
      return res.status(200).json({
        success: true,
        packs: [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: pageNum > 1
        },
        filters: {
          applied: req.query,
          available: AVAILABLE_FILTERS
        },
        metadata: {
          processingTime: Date.now(),
          advancedSearch: useAdvancedSearch,
          includeMetadata: includeMetadata === 'true'
        }
      });
    }

    // Extract pack IDs for fetching related data
    const packIds = packs.map(pack => pack.id);
    
    // Initialize maps for related data
    let versionsMap = {};
    let collaboratorsMap = {};
    let dependenciesMap = {};
    let changesMap = {};

    // Fetch additional data if needed
    if (useAdvancedSearch || includeAllData) {
      const fetchPromises = [];

      // Fetch versions
      fetchPromises.push(
        supabase
          .from('pack_versions')
          .select('*')
          .in('pack_id', packIds)
          .order('version_number', { ascending: false })
          .then(({ data, error }) => {
            if (!error && data) {
              versionsMap = data.reduce((acc, version) => {
                if (!acc[version.pack_id]) acc[version.pack_id] = [];
                acc[version.pack_id].push(version);
                return acc;
              }, {});
            }
            return null;
          })
      );

      // Fetch collaborators
      fetchPromises.push(
        supabase
          .from('pack_collaborators')
          .select('*')
          .in('pack_id', packIds)
          .then(({ data, error }) => {
            if (!error && data) {
              collaboratorsMap = data.reduce((acc, collab) => {
                if (!acc[collab.pack_id]) acc[collab.pack_id] = [];
                acc[collab.pack_id].push(collab);
                return acc;
              }, {});
            }
            return null;
          })
      );

      // Fetch dependencies if dependency filter is active
      if (dependency) {
        fetchPromises.push(
          supabase
            .from('pack_dependencies')
            .select('*')
            .in('pack_id', packIds)
            .ilike('dependency_name', `%${dependency}%`)
            .then(({ data, error }) => {
              if (!error && data) {
                dependenciesMap = data.reduce((acc, dep) => {
                  if (!acc[dep.pack_id]) acc[dep.pack_id] = [];
                  acc[dep.pack_id].push(dep.dependency_name);
                  return acc;
                }, {});
              }
              return null;
            })
        );
      } else if (includeAllData) {
        // Fetch all dependencies for all packs
        fetchPromises.push(
          supabase
            .from('pack_dependencies')
            .select('*')
            .in('pack_id', packIds)
            .then(({ data, error }) => {
              if (!error && data) {
                dependenciesMap = data.reduce((acc, dep) => {
                  if (!acc[dep.pack_id]) acc[dep.pack_id] = [];
                  acc[dep.pack_id].push(dep.dependency_name);
                  return acc;
                }, {});
              }
              return null;
            })
        );
      }

      // Fetch recent changes
      fetchPromises.push(
        supabase
          .from('pack_changes')
          .select('*')
          .in('pack_id', packIds)
          .order('created_at', { ascending: false })
          .limit(100)
          .then(({ data, error }) => {
            if (!error && data) {
              changesMap = data.reduce((acc, change) => {
                if (!acc[change.pack_id]) acc[change.pack_id] = [];
                if (acc[change.pack_id].length < 5) {
                  acc[change.pack_id].push(change);
                }
                return acc;
              }, {});
            }
            return null;
          })
      );

      // Wait for all fetches
      await Promise.allSettled(fetchPromises);
    }

    // Process and enhance results
    const enhancedPacks = packs
      .map(pack => {
        try {
          // Parse pack_json
          let packJson = {};
          try {
            packJson = typeof pack.pack_json === 'string' 
              ? JSON.parse(pack.pack_json) 
              : pack.pack_json || {};
          } catch (e) {
            packJson = {};
          }

          // Extract metadata from pack_metadata relation
          const metadata = pack.pack_metadata?.[0] || {};
          
          // Apply sandbox level filter
          if (sandboxLevel && metadata.sandbox_level !== sandboxLevel) {
            return null;
          }

          // Apply verification filter
          if (verified && metadata.verification_status !== verified) {
            return null;
          }

          // Apply size filters
          if (minSize && metadata.total_size < parseInt(minSize)) {
            return null;
          }
          if (maxSize && metadata.total_size > parseInt(maxSize)) {
            return null;
          }

          // Build enhanced pack
          const enhancedPack = {
            // Basic info
            id: pack.id,
            urlId: pack.url_id,
            name: pack.name,
            version: pack.version,
            packageType: pack.pack_type || 'basic',   // using pack_type column
            isPublic: pack.is_public,
            
            // URLs
            cdnUrl: pack.cdn_url,
            workerUrl: pack.worker_url,
            wasmUrl: pack.wasm_url,
            complexWasmUrl: pack.complex_wasm_url,
            
            // Content info
            description: packJson.description || '',
            author: packJson.author || '',
            keywords: packJson.keywords || [],
            homepage: packJson.homepage || '',
            repository: packJson.repository || '',
            license: packJson.license || 'MIT',
            main: packJson.main || 'index.js',
            scripts: packJson.scripts || {},
            dependencies: packJson.dependencies || {},
            devDependencies: packJson.devDependencies || {},
            pack: packJson.pack || {},
            wasmConfig: packJson.wasmConfig || {},
            
            // Stats
            views: pack.views || 0,
            downloads: pack.downloads || 0,
            
            // Dates
            createdAt: pack.created_at,
            updatedAt: pack.updated_at,
            lastAccessed: pack.last_accessed,
            
            // Publisher info
            publisherId: pack.publisher_id,
            publishIp: pack.publish_ip,
            hasEncryption: !!pack.encrypted_key,
            
            // WASM info
            compileToWasm: pack.compile_to_wasm || false,
            wasmMetadata: pack.wasm_metadata || null
          };

          // Add metadata from pack_metadata table
          if (metadata) {
            enhancedPack.sandboxLevel = metadata.sandbox_level || 'basic';
            enhancedPack.requiresVerification = metadata.requires_verification || false;
            enhancedPack.verificationStatus = metadata.verification_status || 'unverified';
            enhancedPack.fileCount = metadata.file_count || 0;
            enhancedPack.totalSize = metadata.total_size || 0;
            enhancedPack.wasmSize = metadata.wasm_size || 0;
            enhancedPack.complexWasmSize = metadata.complex_wasm_size || 0;
          }

          // Add version info
          if (versionsMap[pack.id]) {
            enhancedPack.versions = versionsMap[pack.id].map(v => ({
              version: v.version,
              versionNumber: v.version_number,
              checksum: v.checksum,
              createdAt: v.created_at,
              publisherId: v.publisher_id,
              size: v.files ? JSON.stringify(v.files).length : 0
            }));
            enhancedPack.versionCount = versionsMap[pack.id].length;
            enhancedPack.latestVersion = versionsMap[pack.id][0]?.version || pack.version;
          }

          // Add collaborators
          if (collaboratorsMap[pack.id]) {
            enhancedPack.collaborators = collaboratorsMap[pack.id].map(c => ({
              userId: c.user_id,
              permissionLevel: c.permission_level,
              invitedBy: c.invited_by,
              acceptedAt: c.accepted_at,
              createdAt: c.created_at
            }));
            enhancedPack.collaboratorCount = collaboratorsMap[pack.id].length;
          }

          // Add dependencies
          if (dependenciesMap[pack.id]) {
            enhancedPack.dependencyList = dependenciesMap[pack.id];
            enhancedPack.dependencyCount = dependenciesMap[pack.id].length;
          }

          // Add recent changes
          if (changesMap[pack.id]) {
            enhancedPack.recentChanges = changesMap[pack.id].map(c => ({
              changeType: c.change_type,
              description: c.description,
              userId: c.user_id,
              createdAt: c.created_at,
              metadata: c.metadata
            }));
          }

          // Apply dependency filter
          if (dependency && !dependenciesMap[pack.id]?.some(d => 
            d.toLowerCase().includes(dependency.toLowerCase())
          )) {
            return null;
          }

          // Calculate relevance score for search results
          if (q) {
            enhancedPack.relevanceScore = calculateEnhancedRelevanceScore(enhancedPack, q);
          }

          // Detect languages
          if (pack.files && typeof pack.files === 'object') {
            enhancedPack.languages = detectLanguagesFromFiles(pack.files);
          } else {
            enhancedPack.languages = ['javascript']; // Default
          }

          // Apply language filter
          if (language && !enhancedPack.languages.includes(language)) {
            return null;
          }

          return enhancedPack;
        } catch (error) {
          console.error('Error processing pack:', pack.id, error);
          return null;
        }
      })
      .filter(pack => pack !== null);

    // Apply sorting
    let sortedPacks = enhancedPacks;
    if (q && sort === 'relevance') {
      sortedPacks = enhancedPacks.sort((a, b) => {
        const scoreA = a.relevanceScore || 0;
        const scoreB = b.relevanceScore || 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        
        // Tie breakers
        if (b.downloads !== a.downloads) return b.downloads - a.downloads;
        if (b.views !== a.views) return b.views - a.views;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    } else if (sort === 'trending') {
      sortedPacks = enhancedPacks.sort((a, b) => {
        // Trending: weight by recency and popularity
        const recencyA = getRecencyScore(a.createdAt);
        const recencyB = getRecencyScore(b.createdAt);
        const trendingA = (a.downloads || 0) * recencyA;
        const trendingB = (b.downloads || 0) * recencyB;
        return trendingB - trendingA;
      });
    }

    // Build response
    const response = {
      success: true,
      packs: sortedPacks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
        hasNextPage: (offset + limitNum) < (count || 0),
        hasPreviousPage: pageNum > 1,
        nextPage: (offset + limitNum) < (count || 0) ? pageNum + 1 : null,
        previousPage: pageNum > 1 ? pageNum - 1 : null
      },
      filters: {
        applied: cleanObject({
          q: q || null,
          type: type || null,
          language: language || null,
          sort: sort || 'relevance',
          minDownloads: parseInt(minDownloads) || null,
          minViews: parseInt(minViews) || null,
          verified: verified || null,
          hasReadme: hasReadme || null,
          hasLicense: hasLicense || null,
          hasTests: hasTests || null,
          dependency: dependency || null,
          author: author || null,
          compileToWasm: compileToWasm || null,
          wasmGenerated: wasmGenerated || null,
          complexWasm: complexWasm || null,
          sandboxLevel: sandboxLevel || null,
          minSize: minSize || null,
          maxSize: maxSize || null
        }),
        available: AVAILABLE_FILTERS
      },
      metadata: {
        processingTime: Date.now(),
        advancedSearch: useAdvancedSearch,
        includeMetadata: includeMetadata === 'true',
        includeAllTables: includeAllData,
        totalPacks: count || 0,
        filteredPacks: sortedPacks.length,
        query: q || null
      },
      installInfo: {
        example: sortedPacks.length > 0 ? `pack install ${sortedPacks[0].name} ${sortedPacks[0].cdnUrl}` : null,
        format: 'pack install <name> <cdn-url>'
      }
    };

    // Add cache headers
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60');
    
    return res.status(200).json(response);

  } catch (error) {
    console.error('Search API error:', {
      message: error.message,
      stack: error.stack,
      query: req.query,
      timestamp: new Date().toISOString()
    });
    
    const statusCode = error.message?.includes('rate limit') ? 429 : 500;
    const errorCode = error.message?.includes('rate limit') ? 'RATE_LIMIT_EXCEEDED' : 'SEARCH_ERROR';
    
    return res.status(statusCode).json({
      success: false,
      error: 'Search failed',
      code: errorCode,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
}

// Enhanced relevance scoring
function calculateEnhancedRelevanceScore(pack, searchQuery) {
  let score = 0;
  const query = searchQuery.toLowerCase();
  const queries = query.split(/\s+/).filter(q => q.length >= 2);
  
  // Exact name match
  if (pack.name.toLowerCase() === query) {
    score += SEARCH_WEIGHTS.NAME_EXACT_MATCH;
  }
  
  // Partial name match
  if (pack.name.toLowerCase().includes(query)) {
    score += SEARCH_WEIGHTS.NAME_PARTIAL_MATCH;
  }
  
  // Multi-word name match
  queries.forEach(q => {
    if (pack.name.toLowerCase().includes(q)) {
      score += SEARCH_WEIGHTS.NAME_PARTIAL_MATCH * 0.5;
    }
  });

  // Description match
  if (pack.description && pack.description.toLowerCase().includes(query)) {
    score += SEARCH_WEIGHTS.DESCRIPTION_MATCH;
  }
  
  queries.forEach(q => {
    if (pack.description?.toLowerCase().includes(q)) {
      score += SEARCH_WEIGHTS.DESCRIPTION_MATCH * 0.3;
    }
  });

  // Keyword matches
  if (pack.keywords && Array.isArray(pack.keywords)) {
    pack.keywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      
      if (keywordLower === query) {
        score += SEARCH_WEIGHTS.KEYWORD_EXACT_MATCH;
      } else if (keywordLower.includes(query)) {
        score += SEARCH_WEIGHTS.KEYWORD_PARTIAL_MATCH;
      }
      
      queries.forEach(q => {
        if (keywordLower === q) {
          score += SEARCH_WEIGHTS.KEYWORD_EXACT_MATCH * 0.7;
        } else if (keywordLower.includes(q)) {
          score += SEARCH_WEIGHTS.KEYWORD_PARTIAL_MATCH * 0.5;
        }
      });
    });
  }

  // Author match
  if (pack.author && pack.author.toLowerCase().includes(query)) {
    score += SEARCH_WEIGHTS.AUTHOR_MATCH;
  }

  // Popularity boost (logarithmic)
  const downloadScore = Math.log10(pack.downloads + 1) * SEARCH_WEIGHTS.POPULARITY;
  const viewScore = Math.log10(pack.views + 1) * SEARCH_WEIGHTS.POPULARITY * 0.7;
  score += downloadScore + viewScore;

  // Recency boost (exponential decay)
  const createdAt = new Date(pack.createdAt);
  const daysOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysOld < 30) {
    const recencyBoost = SEARCH_WEIGHTS.RECENCY * Math.exp(-daysOld / 30);
    score += recencyBoost;
  }

  // Verification boost
  if (pack.verificationStatus === 'approved') {
    score += SEARCH_WEIGHTS.VERIFICATION_BOOST;
  }

  // Recent activity boost
  if (pack.recentChanges && pack.recentChanges.length > 0) {
    const latestChange = new Date(pack.recentChanges[0].createdAt);
    const daysSinceChange = (Date.now() - latestChange.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceChange < 7) {
      const activityBoost = SEARCH_WEIGHTS.RECENT_ACTIVITY * (7 - daysSinceChange) / 7;
      score += activityBoost;
    }
  }

  // WASM support boost
  if (pack.wasmUrl || pack.compileToWasm) {
    score += SEARCH_WEIGHTS.WASM_SUPPORT;
  }
  
  if (pack.complexWasmUrl) {
    score += SEARCH_WEIGHTS.WASM_SUPPORT * 1.5;
  }

  // Version count boost (more versions = more mature)
  if (pack.versionCount > 1) {
    score += Math.min(pack.versionCount * 0.5, 5);
  }

  // Collaborator boost
  if (pack.collaboratorCount > 0) {
    score += Math.min(pack.collaboratorCount * 0.3, 3);
  }

  return Math.round(score * 100) / 100; // Round to 2 decimal places
}

// Helper to detect languages from files
function detectLanguagesFromFiles(files) {
  const languages = new Set();
  const fileTypes = typeof files === 'object' ? files : {};
  
  const languageMap = {
    // JavaScript/TypeScript
    'js': 'javascript',
    'mjs': 'javascript',
    'cjs': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    
    // WebAssembly
    'wasm': 'wasm',
    'wat': 'wasm',
    
    // Python
    'py': 'python',
    'pyc': 'python',
    'pyo': 'python',
    
    // Rust
    'rs': 'rust',
    'rlib': 'rust',
    
    // Go
    'go': 'go',
    
    // Zig
    'zig': 'zig',
    
    // Data formats
    'json': 'json',
    'yaml': 'json',
    'yml': 'json',
    'xml': 'json',
    
    // Documentation
    'md': 'markdown',
    'markdown': 'markdown',
    'txt': 'text',
    
    // Web
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'css',
    'sass': 'css',
    
    // Images
    'png': 'image',
    'jpg': 'image',
    'jpeg': 'image',
    'gif': 'image',
    'svg': 'image',
    'webp': 'image',
    
    // Data files
    'csv': 'data',
    'tsv': 'data',
    
    // Binary
    'bin': 'binary',
    'dat': 'binary'
  };

  Object.keys(fileTypes).forEach(filename => {
    const ext = filename.split('.').pop().toLowerCase();
    if (languageMap[ext]) {
      languages.add(languageMap[ext]);
    }
  });

  if (languages.size === 0) {
    languages.add('javascript');
  }

  return Array.from(languages);
}

// Helper for trending score
function getRecencyScore(dateString) {
  const date = new Date(dateString);
  const daysOld = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0.1, Math.exp(-daysOld / 30)); // Exponential decay over 30 days
}

// Helper to clean null values from object
function cleanObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v != null)
  );
}

// Export helpers for testing
export {
  calculateEnhancedRelevanceScore,
  detectLanguagesFromFiles,
  getRecencyScore,
  cleanObject
};
