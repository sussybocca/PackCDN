// /api/search.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Search scoring weights
const SEARCH_WEIGHTS = {
  NAME_MATCH: 10,
  DESCRIPTION_MATCH: 5,
  KEYWORD_MATCH: 3,
  POPULARITY: 2,
  RECENCY: 1
};

// Available filters
const AVAILABLE_FILTERS = {
  type: ['basic', 'standard', 'advanced'],
  language: ['javascript', 'python', 'wasm', 'json', 'markdown', 'mixed'],
  minVersion: null,
  maxVersion: null,
  hasReadme: null,
  hasLicense: null,
  hasTests: null,
  verified: null,
  dependency: null,
  author: null,
  minDownloads: null,
  minViews: null,
  sort: ['relevance', 'popular', 'newest', 'updated', 'name']
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    const { 
      q, 
      type, 
      language,
      minVersion,
      maxVersion,
      hasReadme,
      hasLicense,
      hasTests,
      verified,
      dependency,
      author,
      minDownloads = 0,
      minViews = 0,
      sort = 'relevance',
      page = 1,
      limit = 20,
      includeMetadata = 'true',
      advanced = 'false'
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit) > 100 ? 100 : parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    const useAdvancedSearch = advanced === 'true';

    // Build base query - start with packs table for backward compatibility
    let query = supabase
      .from('packs')
      .select(`
        id,
        url_id,
        name,
        pack_json,
        version,
        cdn_url,
        worker_url,
        is_public,
        created_at,
        updated_at,
        views,
        downloads,
        publisher_id,
        package_type,
        last_accessed,
        publish_ip,
        encrypted_key,
        files
      `, { count: 'exact' })
      .eq('is_public', true);

    // Apply basic filters (backward compatible)
    if (q) {
      // Enhanced search: search in name, pack_json (description), and keywords
      const searchTerms = q.toLowerCase().trim();
      
      // We'll use multiple OR conditions for better search
      query = query.or(`
        name.ilike.%${searchTerms}%,
        pack_json->>'description'.ilike.%${searchTerms}%,
        pack_json->>'keywords'.ilike.%${searchTerms}%,
        pack_json->>'author'.ilike.%${searchTerms}%
      `);
    }

    // Package type filter
    if (type && ['basic', 'standard', 'advanced'].includes(type)) {
      query = query.eq('package_type', type);
    }

    // Version range filter
    if (minVersion) {
      query = query.gte('version', minVersion);
    }
    if (maxVersion) {
      query = query.lte('version', maxVersion);
    }

    // Boolean filters
    if (hasReadme === 'true') {
      query = query.ilike('pack_json', '%README%');
    }
    
    if (hasLicense === 'true') {
      query = query.ilike('pack_json', '%LICENSE%');
    }
    
    if (hasTests === 'true') {
      query = query.or('name.ilike.%test%,name.ilike.%spec%');
    }

    // Author/Publisher filter
    if (author) {
      query = query.or(`
        pack_json->>'author'.ilike.%${author}%,
        publisher_id.ilike.%${author}%
      `);
    }

    // Popularity filters
    if (parseInt(minDownloads) > 0) {
      query = query.gte('downloads', parseInt(minDownloads));
    }
    
    if (parseInt(minViews) > 0) {
      query = query.gte('views', parseInt(minViews));
    }

    // Sorting
    switch (sort) {
      case 'popular':
        query = query.order('downloads', { ascending: false });
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
      case 'relevance':
      default:
        // Default: sort by relevance (downloads + recency)
        if (q) {
          // When searching, we want relevance-based sorting
          // We'll handle this after fetching results
          query = query.order('downloads', { ascending: false });
        } else {
          query = query.order('created_at', { ascending: false });
        }
        break;
    }

    // Get total count first for pagination
    const { count, error: countError } = await query;
    
    if (countError) throw countError;

    // Apply pagination
    query = query.range(offset, offset + limitNum - 1);

    // Execute query for packs
    const { data: packs, error } = await query;
    
    if (error) throw error;

    // If no packs found, return empty
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
          applied: {
            q: q || null,
            type: type || null,
            language: language || null,
            sort: sort || 'relevance'
          },
          available: AVAILABLE_FILTERS
        },
        metadata: {
          processingTime: Date.now(),
          advancedSearch: useAdvancedSearch,
          includeMetadata: includeMetadata === 'true'
        }
      });
    }

    // Get pack IDs for fetching additional data
    const packIds = packs.map(pack => pack.id);

    // Fetch additional data from other tables if advanced search is enabled
    let metadataMap = {};
    let versionsMap = {};
    let collaboratorsMap = {};
    let dependenciesMap = {};
    let changesMap = {};

    if (useAdvancedSearch) {
      // Fetch metadata
      try {
        const { data: metadata, error: metaError } = await supabase
          .from('pack_metadata')
          .select('*')
          .in('pack_id', packIds);

        if (!metaError && metadata) {
          metadata.forEach(meta => {
            metadataMap[meta.pack_id] = meta;
          });
        }
      } catch (metaErr) {
        console.warn('Error fetching metadata:', metaErr.message);
      }

      // Fetch versions
      try {
        const { data: versions, error: versionsError } = await supabase
          .from('pack_versions')
          .select('*')
          .in('pack_id', packIds)
          .order('version_number', { ascending: false });

        if (!versionsError && versions) {
          versionsMap = versions.reduce((acc, version) => {
            if (!acc[version.pack_id]) {
              acc[version.pack_id] = [];
            }
            acc[version.pack_id].push(version);
            return acc;
          }, {});
        }
      } catch (versionsErr) {
        console.warn('Error fetching versions:', versionsErr.message);
      }

      // Fetch collaborators
      try {
        const { data: collaborators, error: collabError } = await supabase
          .from('pack_collaborators')
          .select('*')
          .in('pack_id', packIds);

        if (!collabError && collaborators) {
          collaboratorsMap = collaborators.reduce((acc, collab) => {
            if (!acc[collab.pack_id]) {
              acc[collab.pack_id] = [];
            }
            acc[collab.pack_id].push(collab);
            return acc;
          }, {});
        }
      } catch (collabErr) {
        console.warn('Error fetching collaborators:', collabErr.message);
      }

      // Fetch dependencies if dependency filter is active
      if (dependency) {
        try {
          const { data: deps, error: depError } = await supabase
            .from('pack_dependencies')
            .select('*')
            .in('pack_id', packIds)
            .ilike('dependency_name', `%${dependency}%`);

          if (!depError && deps) {
            deps.forEach(dep => {
              if (!dependenciesMap[dep.pack_id]) {
                dependenciesMap[dep.pack_id] = [];
              }
              dependenciesMap[dep.pack_id].push(dep.dependency_name);
            });
          }
        } catch (depErr) {
          console.warn('Error fetching dependencies:', depErr.message);
        }
      }

      // Fetch recent changes
      try {
        const { data: changes, error: changesError } = await supabase
          .from('pack_changes')
          .select('*')
          .in('pack_id', packIds)
          .order('created_at', { ascending: false })
          .limit(3 * packIds.length); // Get recent changes for all packs

        if (!changesError && changes) {
          changesMap = changes.reduce((acc, change) => {
            if (!acc[change.pack_id]) {
              acc[change.pack_id] = [];
            }
            if (acc[change.pack_id].length < 3) { // Limit to 3 recent changes per pack
              acc[change.pack_id].push(change);
            }
            return acc;
          }, {});
        }
      } catch (changesErr) {
        console.warn('Error fetching changes:', changesErr.message);
      }
    }

    // Process and enhance results
    const enhancedPacks = packs.map(pack => {
      const enhancedPack = {
        id: pack.id,
        urlId: pack.url_id,
        name: pack.name,
        version: pack.version,
        cdnUrl: pack.cdn_url,
        workerUrl: pack.worker_url,
        isPublic: pack.is_public,
        createdAt: pack.created_at,
        updatedAt: pack.updated_at,
        lastAccessed: pack.last_accessed,
        views: pack.views,
        downloads: pack.downloads,
        publisherId: pack.publisher_id,
        packageType: pack.package_type || 'basic',
        publishIp: pack.publish_ip,
        hasEncryption: !!pack.encrypted_key
      };

      // Parse pack_json
      try {
        const packJson = JSON.parse(pack.pack_json);
        enhancedPack.description = packJson.description || '';
        enhancedPack.author = packJson.author || '';
        enhancedPack.keywords = packJson.keywords || [];
        enhancedPack.homepage = packJson.homepage || '';
        enhancedPack.repository = packJson.repository || '';
        enhancedPack.license = packJson.license || '';
        enhancedPack.main = packJson.main || 'index.js';
        enhancedPack.scripts = packJson.scripts || {};
        enhancedPack.dependencies = packJson.dependencies || {};
        enhancedPack.devDependencies = packJson.devDependencies || {};
      } catch (e) {
        enhancedPack.description = '';
        enhancedPack.author = '';
        enhancedPack.keywords = [];
        enhancedPack.dependencies = {};
      }

      // Add metadata if available
      if (includeMetadata === 'true' && metadataMap[pack.id]) {
        const metadata = metadataMap[pack.id];
        enhancedPack.sandboxLevel = metadata.sandbox_level || 'basic';
        enhancedPack.requiresVerification = metadata.requires_verification || false;
        enhancedPack.verificationStatus = metadata.verification_status || 'unverified';
        enhancedPack.fileCount = metadata.file_count || 0;
        enhancedPack.totalSize = metadata.total_size || 0;
        
        // Calculate languages from files if available
        if (pack.files && typeof pack.files === 'object') {
          enhancedPack.languages = detectLanguagesFromFiles(pack.files);
        }
      }

      // Add version info
      if (versionsMap[pack.id] && versionsMap[pack.id].length > 0) {
        enhancedPack.versions = versionsMap[pack.id].map(v => ({
          version: v.version,
          versionNumber: v.version_number,
          checksum: v.checksum,
          createdAt: v.created_at,
          publisherId: v.publisher_id
        }));
        enhancedPack.latestVersion = versionsMap[pack.id][0].version;
        enhancedPack.versionCount = versionsMap[pack.id].length;
      }

      // Add collaborators
      if (collaboratorsMap[pack.id] && collaboratorsMap[pack.id].length > 0) {
        enhancedPack.collaborators = collaboratorsMap[pack.id].map(c => ({
          userId: c.user_id,
          permissionLevel: c.permission_level,
          invitedBy: c.invited_by,
          acceptedAt: c.accepted_at
        }));
        enhancedPack.collaboratorCount = collaboratorsMap[pack.id].length;
      }

      // Add dependencies
      if (dependenciesMap[pack.id]) {
        enhancedPack.dependencyList = dependenciesMap[pack.id];
      }

      // Add recent changes
      if (changesMap[pack.id] && changesMap[pack.id].length > 0) {
        enhancedPack.recentChanges = changesMap[pack.id].map(c => ({
          changeType: c.change_type,
          description: c.description,
          userId: c.user_id,
          createdAt: c.created_at,
          metadata: c.metadata
        }));
      }

      // Apply dependency filter - if dependency specified, only include packs that have it
      if (dependency && useAdvancedSearch) {
        const hasDependency = dependenciesMap[pack.id] && 
          dependenciesMap[pack.id].some(dep => 
            dep.toLowerCase().includes(dependency.toLowerCase())
          );
        
        if (!hasDependency) {
          return null; // Skip this pack
        }
      }

      // Apply verification filter
      if (verified === 'true' && useAdvancedSearch) {
        if (enhancedPack.verificationStatus !== 'verified') {
          return null; // Skip this pack
        }
      }

      // Calculate relevance score for search results
      if (q) {
        enhancedPack.relevanceScore = calculateRelevanceScore(enhancedPack, q);
      }

      return enhancedPack;
    }).filter(pack => pack !== null); // Remove null packs from filtering

    // Apply relevance sorting if search query exists
    let sortedPacks = enhancedPacks;
    if (q && sort === 'relevance') {
      sortedPacks = enhancedPacks.sort((a, b) => {
        const scoreA = a.relevanceScore || 0;
        const scoreB = b.relevanceScore || 0;
        return scoreB - scoreA;
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
        hasPreviousPage: pageNum > 1
      },
      filters: {
        applied: {
          q: q || null,
          type: type || null,
          language: language || null,
          sort: sort || 'relevance',
          minDownloads: parseInt(minDownloads) || null,
          minViews: parseInt(minViews) || null,
          verified: verified === 'true' || null,
          hasReadme: hasReadme === 'true' || null,
          hasLicense: hasLicense === 'true' || null,
          hasTests: hasTests === 'true' || null,
          dependency: dependency || null,
          author: author || null
        },
        available: AVAILABLE_FILTERS
      },
      metadata: {
        processingTime: Date.now(),
        advancedSearch: useAdvancedSearch,
        includeMetadata: includeMetadata === 'true',
        totalPacks: count || 0,
        filteredPacks: sortedPacks.length
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Search error:', error);
    
    // Provide more specific error messages
    let statusCode = 500;
    let errorMessage = 'Search failed';
    let errorCode = 'SEARCH_ERROR';

    if (error.message.includes('does not exist')) {
      statusCode = 400;
      errorMessage = 'Database schema mismatch. Please check if all required tables exist.';
      errorCode = 'SCHEMA_MISMATCH';
    } else if (error.message.includes('timeout')) {
      statusCode = 504;
      errorMessage = 'Search timeout. Try simplifying your query.';
      errorCode = 'TIMEOUT';
    } else if (error.message.includes('rate limit')) {
      statusCode = 429;
      errorMessage = 'Rate limit exceeded. Please try again later.';
      errorCode = 'RATE_LIMIT';
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      code: errorCode,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Helper function to calculate relevance score
function calculateRelevanceScore(pack, searchQuery) {
  let score = 0;
  const query = searchQuery.toLowerCase();
  
  // Name match (highest weight)
  if (pack.name.toLowerCase().includes(query)) {
    score += SEARCH_WEIGHTS.NAME_MATCH;
  }
  
  // Description match
  if (pack.description && pack.description.toLowerCase().includes(query)) {
    score += SEARCH_WEIGHTS.DESCRIPTION_MATCH;
  }
  
  // Keyword match
  if (pack.keywords && Array.isArray(pack.keywords)) {
    const keywordMatches = pack.keywords.filter(keyword => 
      keyword.toLowerCase().includes(query)
    ).length;
    score += keywordMatches * SEARCH_WEIGHTS.KEYWORD_MATCH;
  }
  
  // Author match
  if (pack.author && pack.author.toLowerCase().includes(query)) {
    score += SEARCH_WEIGHTS.DESCRIPTION_MATCH;
  }
  
  // Popularity boost
  score += Math.log10(pack.downloads + 1) * SEARCH_WEIGHTS.POPULARITY;
  
  // Recency boost (packages from last 30 days get a boost)
  const createdAt = new Date(pack.createdAt);
  const daysOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysOld < 30) {
    score += SEARCH_WEIGHTS.RECENCY * (30 - daysOld) / 30;
  }
  
  // Verification boost
  if (pack.verificationStatus === 'verified') {
    score += 5;
  }
  
  // Recent activity boost
  if (pack.recentChanges && pack.recentChanges.length > 0) {
    const latestChange = new Date(pack.recentChanges[0].createdAt);
    const daysSinceChange = (Date.now() - latestChange.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceChange < 7) {
      score += 3;
    }
  }
  
  return score;
}

// Helper function to detect languages from files
function detectLanguagesFromFiles(files) {
  const languages = new Set();
  const extMap = {
    'js': 'javascript',
    'mjs': 'javascript',
    'cjs': 'javascript',
    'jsx': 'javascript',
    'ts': 'javascript',
    'tsx': 'javascript',
    'py': 'python',
    'pyc': 'python',
    'pyo': 'python',
    'wasm': 'wasm',
    'json': 'json',
    'md': 'markdown',
    'markdown': 'markdown',
    'txt': 'text',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'css',
    'sass': 'css',
    'png': 'image',
    'jpg': 'image',
    'jpeg': 'image',
    'gif': 'image',
    'svg': 'image',
    'webp': 'image',
    'csv': 'data',
    'tsv': 'data',
    'xml': 'data',
    'yaml': 'data',
    'yml': 'data'
  };

  Object.keys(files).forEach(filename => {
    const ext = filename.split('.').pop().toLowerCase();
    if (extMap[ext]) {
      languages.add(extMap[ext]);
    }
  });

  if (languages.size === 0) {
    languages.add('javascript'); // Default
  }

  return Array.from(languages);
}

// Helper function to extract description from pack_json
function extractDescription(packJson) {
  try {
    const json = typeof packJson === 'string' ? JSON.parse(packJson) : packJson;
    return json.description || '';
  } catch (e) {
    return '';
  }
}

// Helper function to extract author from pack_json
function extractAuthor(packJson) {
  try {
    const json = typeof packJson === 'string' ? JSON.parse(packJson) : packJson;
    return json.author || '';
  } catch (e) {
    return '';
  }
}

// Export for testing
if (process.env.NODE_ENV === 'test') {
  module.exports = {
    calculateRelevanceScore,
    detectLanguagesFromFiles,
    extractDescription,
    extractAuthor
  };
}
