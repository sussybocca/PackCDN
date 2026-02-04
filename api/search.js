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
    const limitNum = parseInt(limit) > 100 ? 100 : parseInt(limit); // Cap at 100
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
        pack_metadata!left (
          package_type,
          sandbox_level,
          requires_verification,
          verification_status,
          file_count,
          total_size
        ),
        pack_versions!inner (
          version,
          version_number,
          created_at
        ),
        pack_collaborators (
          user_id,
          permission_level
        )
      `)
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
      if (useAdvancedSearch) {
        query = query.eq('pack_metadata.package_type', type);
      } else {
        // Legacy fallback: check if package_type exists in packs table
        const { data: hasColumn } = await supabase
          .rpc('column_exists', { table_name: 'packs', column_name: 'package_type' });
        
        if (hasColumn) {
          query = query.eq('package_type', type);
        }
      }
    }

    // Language filter (new)
    if (language && useAdvancedSearch) {
      // Determine language from file extensions
      const languageExts = {
        javascript: ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx'],
        python: ['py', 'pyc', 'pyo'],
        wasm: ['wasm'],
        json: ['json'],
        markdown: ['md', 'markdown']
      };

      if (languageExts[language]) {
        // Note: This is a simplified approach. In production, you'd want to
        // check actual file extensions in the files column or metadata
        query = query.ilike('pack_json', `%${language}%`);
      }
    }

    // Version range filter
    if (minVersion || maxVersion) {
      // Using pack_versions subquery
      if (useAdvancedSearch) {
        if (minVersion) {
          query = query.gte('pack_versions.version', minVersion);
        }
        if (maxVersion) {
          query = query.lte('pack_versions.version', maxVersion);
        }
      } else {
        // Legacy: filter on main version field
        if (minVersion) {
          query = query.gte('version', minVersion);
        }
        if (maxVersion) {
          query = query.lte('version', maxVersion);
        }
      }
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
    
    if (verified === 'true' && useAdvancedSearch) {
      query = query.eq('pack_metadata.verification_status', 'verified');
    }

    // Dependency filter
    if (dependency && useAdvancedSearch) {
      // Join with pack_dependencies table
      const { data: depPacks } = await supabase
        .from('pack_dependencies')
        .select('pack_id')
        .ilike('dependency_name', `%${dependency}%`);
      
      if (depPacks && depPacks.length > 0) {
        const packIds = depPacks.map(dep => dep.pack_id);
        query = query.in('id', packIds);
      } else {
        // Return empty result if no packages have this dependency
        query = query.eq('id', 'no-match-123');
      }
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
    const { count, error: countError } = await query
      .select('*', { count: 'exact', head: true });
    
    if (countError) throw countError;

    // Apply pagination
    query = query.range(offset, offset + limitNum - 1);

    // Execute query
    const { data, error } = await query;
    
    if (error) throw error;

    // Process and enhance results
    const enhancedPacks = await Promise.all(
      (data || []).map(async pack => {
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
          views: pack.views,
          downloads: pack.downloads,
          publisherId: pack.publisher_id
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
        } catch (e) {
          enhancedPack.description = '';
          enhancedPack.author = '';
          enhancedPack.keywords = [];
        }

        // Add metadata if available and requested
        if (includeMetadata === 'true' && pack.pack_metadata && pack.pack_metadata.length > 0) {
          const metadata = pack.pack_metadata[0];
          enhancedPack.packageType = metadata.package_type || 'basic';
          enhancedPack.sandboxLevel = metadata.sandbox_level || 'basic';
          enhancedPack.requiresVerification = metadata.requires_verification || false;
          enhancedPack.verificationStatus = metadata.verification_status || 'unverified';
          enhancedPack.fileCount = metadata.file_count || 0;
          enhancedPack.totalSize = metadata.total_size || 0;
          
          // Calculate language distribution from file extensions
          if (useAdvancedSearch) {
            enhancedPack.languages = await detectLanguages(pack.id);
          }
        } else {
          enhancedPack.packageType = 'basic'; // Default for backward compatibility
        }

        // Add version info
        if (pack.pack_versions && pack.pack_versions.length > 0) {
          enhancedPack.versions = pack.pack_versions.map(v => ({
            version: v.version,
            versionNumber: v.version_number,
            createdAt: v.created_at
          }));
          enhancedPack.latestVersion = pack.pack_versions[0].version;
          enhancedPack.versionCount = pack.pack_versions.length;
        }

        // Add collaborators if available
        if (pack.pack_collaborators && pack.pack_collaborators.length > 0) {
          enhancedPack.collaborators = pack.pack_collaborators.map(c => ({
            userId: c.user_id,
            permissionLevel: c.permission_level
          }));
          enhancedPack.collaboratorCount = pack.pack_collaborators.length;
        }

        // Calculate relevance score for search results
        if (q) {
          enhancedPack.relevanceScore = calculateRelevanceScore(enhancedPack, q);
        }

        return enhancedPack;
      })
    );

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
          sort: sort || 'relevance'
        },
        available: AVAILABLE_FILTERS
      },
      metadata: {
        processingTime: Date.now(),
        advancedSearch: useAdvancedSearch,
        includeMetadata: includeMetadata === 'true'
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
  
  // Popularity boost
  score += Math.log10(pack.downloads + 1) * SEARCH_WEIGHTS.POPULARITY;
  
  // Recency boost (packages from last 30 days get a boost)
  const createdAt = new Date(pack.createdAt);
  const daysOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysOld < 30) {
    score += SEARCH_WEIGHTS.RECENCY * (30 - daysOld) / 30;
  }
  
  return score;
}

// Helper function to detect languages from a package
async function detectLanguages(packId) {
  try {
    const { data: dependencies } = await supabase
      .from('pack_dependencies')
      .select('dependency_name')
      .eq('pack_id', packId)
      .limit(10);
    
    // Simplified language detection based on dependencies
    const languages = new Set();
    
    if (dependencies && dependencies.length > 0) {
      // Check for language-specific dependencies
      const jsDeps = ['react', 'vue', 'angular', 'express', 'lodash'];
      const pythonDeps = ['django', 'flask', 'numpy', 'pandas'];
      
      dependencies.forEach(dep => {
        const depName = dep.dependency_name.toLowerCase();
        if (jsDeps.some(jsDep => depName.includes(jsDep))) {
          languages.add('javascript');
        }
        if (pythonDeps.some(pyDep => depName.includes(pyDep))) {
          languages.add('python');
        }
      });
    }
    
    // Default to JavaScript if no specific language detected
    if (languages.size === 0) {
      languages.add('javascript');
    }
    
    return Array.from(languages);
  } catch (error) {
    return ['javascript']; // Default fallback
  }
}

// Backward compatibility endpoint for old clients
export const config = {
  api: {
    externalResolver: true,
  },
};
