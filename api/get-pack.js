import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ============================================================================
// Enhanced pack response formatter (fully restored)
// ============================================================================
function formatPackResponse(pack, metadata = null, versions = [], dependencies = [], collaborators = [], changes = []) {
  const isPublic = pack.is_public !== false;
  const packageType = pack.package_type || 'basic';
  
  // Parse pack_json if it's a string
  let packJson = pack.pack_json;
  if (typeof packJson === 'string') {
    try {
      packJson = JSON.parse(packJson);
    } catch (e) {
      console.warn('Failed to parse pack_json:', e);
      packJson = {};
    }
  }
  
  // Parse files if it's a string
  let files = pack.files;
  if (typeof files === 'string') {
    try {
      files = JSON.parse(files);
    } catch (e) {
      console.warn('Failed to parse files:', e);
      files = {};
    }
  }
  
  // Format version history
  const formattedVersions = versions.map(v => ({
    version: v.version,
    version_number: v.version_number,
    created_at: v.created_at,
    publisher_id: v.publisher_id,
    checksum: v.checksum,
    size: v.files ? JSON.stringify(v.files).length : 0
  })).sort((a, b) => b.version_number - a.version_number);
  
  // Get latest version
  const latestVersion = formattedVersions.length > 0 ? formattedVersions[0] : {
    version: pack.version || '1.0.0',
    version_number: 1,
    created_at: pack.created_at,
    publisher_id: pack.publisher_id
  };
  
  // Format metadata
  const formattedMetadata = metadata ? {
    package_type: metadata.package_type,
    sandbox_level: metadata.sandbox_level,
    verification_status: metadata.verification_status,
    file_count: metadata.file_count,
    total_size: metadata.total_size,
    wasm_size: metadata.wasm_size || 0,
    complex_wasm_size: metadata.complex_wasm_size || 0,
    last_accessed: metadata.last_accessed,
    compile_to_wasm: pack.compile_to_wasm || false,
    wasm_generated: !!(pack.wasm_url || metadata.wasm_size),
    complex_wasm_generated: !!(pack.complex_wasm_url || metadata.complex_wasm_size)
  } : {
    package_type: packageType,
    sandbox_level: 'basic',
    file_count: Object.keys(files || {}).length,
    total_size: JSON.stringify(files || {}).length,
    wasm_generated: !!pack.wasm_url,
    complex_wasm_generated: !!pack.complex_wasm_url
  };
  
  // Format dependencies
  const formattedDependencies = dependencies.map(d => d.dependency_name);
  
  // Format collaborators
  const formattedCollaborators = collaborators.map(c => ({
    user_id: c.user_id,
    permission_level: c.permission_level,
    invited_by: c.invited_by,
    accepted_at: c.accepted_at
  }));
  
  // Format recent changes
  const formattedChanges = changes.slice(0, 10).map(c => ({
    change_type: c.change_type,
    description: c.description,
    user_id: c.user_id,
    created_at: c.created_at,
    metadata: c.metadata
  }));
  
  // Calculate total downloads from all versions
  const totalDownloads = pack.downloads || 0;
  const totalViews = pack.views || 0;
  
  // Build response object
  const response = {
    success: true,
    pack: {
      // Basic info
      id: pack.id,
      url_id: pack.url_id,
      name: pack.name,
      version: pack.version,
      package_type: packageType,
      is_public: isPublic,
      
      // URLs
      cdn_url: pack.cdn_url,
      worker_url: pack.worker_url,
      wasm_url: pack.wasm_url,
      complex_wasm_url: pack.complex_wasm_url,
      
      // Content
      pack_json: packJson,
      files: files,
      encrypted_key: isPublic ? undefined : pack.encrypted_key, // Hide key for private packages
      
      // Publisher info
      publisher_id: pack.publisher_id,
      created_at: pack.created_at,
      updated_at: pack.updated_at,
      last_accessed: pack.last_accessed,
      
      // Stats
      views: totalViews,
      downloads: totalDownloads,
      
      // WASM info
      compile_to_wasm: pack.compile_to_wasm || false,
      wasm_metadata: pack.wasm_metadata || null,
      
      // Version info
      version_info: {
        current: latestVersion.version,
        number: latestVersion.version_number,
        total_versions: formattedVersions.length,
        all_versions: formattedVersions
      }
    },
    
    metadata: formattedMetadata,
    
    // Advanced features
    advanced: {
      has_dependencies: formattedDependencies.length > 0,
      has_collaborators: formattedCollaborators.length > 0,
      has_wasm: formattedMetadata.wasm_generated,
      has_complex_wasm: formattedMetadata.complex_wasm_generated,
      version_history: formattedVersions.length > 1,
      verification_required: metadata?.requires_verification || false,
      verification_status: metadata?.verification_status || 'unknown'
    },
    
    // Lists
    dependencies: formattedDependencies,
    collaborators: formattedCollaborators,
    recent_changes: formattedChanges,
    
    // Download/install info
    install_info: {
      pack_cli: `pack install ${pack.name}@${latestVersion.version}`,
      npm: `npm install ${pack.name}@${latestVersion.version}`,
      yarn: `yarn add ${pack.name}@${latestVersion.version}`,
      direct_url: pack.cdn_url,
      wasm_url: pack.wasm_url,
      complex_wasm_url: pack.complex_wasm_url
    },
    
    // API endpoints
    api_endpoints: {
      versions: `/api/pack-versions?id=${pack.id}`,
      download: `/api/download-pack?id=${pack.url_id}`,
      wasm: pack.wasm_url ? `/api/wasm-pack?id=${pack.url_id}` : null,
      stats: `/api/pack-stats?id=${pack.id}`
    },
    
    // Quick stats
    stats: {
      total_files: Object.keys(files || {}).length,
      total_size: formattedMetadata.total_size,
      wasm_size: formattedMetadata.wasm_size,
      complex_wasm_size: formattedMetadata.complex_wasm_size,
      view_count: totalViews,
      download_count: totalDownloads,
      version_count: formattedVersions.length,
      dependency_count: formattedDependencies.length,
      collaborator_count: formattedCollaborators.length
    }
  };
  
  return response;
}

// ============================================================================
// Helper to get all pack data (improved error handling)
// ============================================================================
async function getCompletePackData(packId, includeAdvanced = true) {
  console.log(`[getCompletePackData] Searching for pack with identifier: ${packId}`);

  try {
    // First, try to find by url_id
    console.log(`[getCompletePackData] Querying packs where url_id = '${packId}'`);
    let { data: pack, error: packError } = await supabase
      .from('packs')
      .select('*')
      .eq('url_id', packId)
      .maybeSingle();

    if (packError) {
      console.error('[getCompletePackData] Supabase error when querying by url_id:', packError);
      return { error: `Database error: ${packError.message}` };
    }

    if (pack) {
      console.log(`[getCompletePackData] Found pack by url_id: ${pack.id}`);
    } else {
      // If not found by url_id, try by id (convert to number if possible)
      console.log(`[getCompletePackData] No pack found by url_id, trying by id: '${packId}'`);
      
      // If packId looks like a UUID, use as is; otherwise try to parse as number
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(packId);
      const queryValue = isUUID ? packId : (isNaN(Number(packId)) ? packId : Number(packId));

      const result = await supabase
        .from('packs')
        .select('*')
        .eq('id', queryValue)
        .maybeSingle();

      pack = result.data;
      packError = result.error;

      if (packError) {
        console.error('[getCompletePackData] Supabase error when querying by id:', packError);
        return { error: `Database error: ${packError.message}` };
      }

      if (pack) {
        console.log(`[getCompletePackData] Found pack by id: ${pack.id}`);
      } else {
        console.log('[getCompletePackData] Pack not found by either url_id or id');
        return { error: 'Pack not found' };
      }
    }

    // Initialize results
    const results = {
      pack,
      metadata: null,
      versions: [],
      dependencies: [],
      collaborators: [],
      changes: []
    };

    // Get advanced data if requested
    if (includeAdvanced) {
      console.log('[getCompletePackData] Fetching advanced data...');
      const promises = [
        supabase.from('pack_metadata').select('*').eq('pack_id', pack.id).maybeSingle(),
        supabase.from('pack_versions').select('*').eq('pack_id', pack.id).order('version_number', { ascending: false }),
        supabase.from('pack_dependencies').select('dependency_name').eq('pack_id', pack.id),
        supabase.from('pack_collaborators').select('*').eq('pack_id', pack.id).order('created_at', { ascending: false }),
        supabase.from('pack_changes').select('*').eq('pack_id', pack.id).order('created_at', { ascending: false }).limit(10)
      ];

      const [
        metadataResult,
        versionsResult,
        dependenciesResult,
        collaboratorsResult,
        changesResult
      ] = await Promise.allSettled(promises);

      // Process results with logging
      if (metadataResult.status === 'fulfilled' && metadataResult.value.data) {
        results.metadata = metadataResult.value.data;
      } else if (metadataResult.status === 'rejected') {
        console.warn('[getCompletePackData] Metadata fetch rejected:', metadataResult.reason);
      }

      if (versionsResult.status === 'fulfilled' && versionsResult.value.data) {
        results.versions = versionsResult.value.data;
      } else if (versionsResult.status === 'rejected') {
        console.warn('[getCompletePackData] Versions fetch rejected:', versionsResult.reason);
      }

      if (dependenciesResult.status === 'fulfilled' && dependenciesResult.value.data) {
        results.dependencies = dependenciesResult.value.data;
      } else if (dependenciesResult.status === 'rejected') {
        console.warn('[getCompletePackData] Dependencies fetch rejected:', dependenciesResult.reason);
      }

      if (collaboratorsResult.status === 'fulfilled' && collaboratorsResult.value.data) {
        results.collaborators = collaboratorsResult.value.data;
      } else if (collaboratorsResult.status === 'rejected') {
        console.warn('[getCompletePackData] Collaborators fetch rejected:', collaboratorsResult.reason);
      }

      if (changesResult.status === 'fulfilled' && changesResult.value.data) {
        results.changes = changesResult.value.data;
      } else if (changesResult.status === 'rejected') {
        console.warn('[getCompletePackData] Changes fetch rejected:', changesResult.reason);
      }
    }

    // Increment view count (non-critical, don't wait)
    supabase
      .from('packs')
      .update({ 
        views: (pack.views || 0) + 1,
        last_accessed: new Date().toISOString()
      })
      .eq('id', pack.id)
      .then(({ error }) => {
        if (error) console.warn('[getCompletePackData] Failed to increment view count:', error);
      });

    return results;

  } catch (error) {
    console.error('[getCompletePackData] Unexpected error:', error);
    return { error: error.message };
  }
}

// ============================================================================
// Main handler
// ============================================================================
export default async function handler(req, res) {
  const { id, includeAdvanced = 'true' } = req.query;

  if (!id) {
    return res.status(400).json({ 
      success: false,
      error: 'Missing pack ID',
      code: 'MISSING_ID'
    });
  }

  try {
    console.log(`[handler] Received request for pack ID: ${id}`);

    const includeAdvancedData = includeAdvanced !== 'false';
    const packData = await getCompletePackData(id, includeAdvancedData);

    if (packData.error) {
      console.log(`[handler] Error for pack ${id}: ${packData.error}`);
      if (packData.error === 'Pack not found') {
        return res.status(404).json({
          success: false,
          error: 'Pack not found',
          code: 'PACK_NOT_FOUND',
          debug: `No pack found with identifier: ${id}`
        });
      } else {
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch pack data',
          code: 'FETCH_ERROR',
          details: process.env.NODE_ENV === 'development' ? packData.error : undefined
        });
      }
    }

    const { pack, metadata, versions, dependencies, collaborators, changes } = packData;

    console.log(`[handler] Found pack: ${pack.name} (${pack.id})`);

    const response = formatPackResponse(pack, metadata, versions, dependencies, collaborators, changes);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120');

    res.status(200).json(response);

  } catch (error) {
    console.error('[handler] Unhandled error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// ============================================================================
// HEAD handler (check existence)
// ============================================================================
export async function headHandler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).end();
  }

  try {
    // Try url_id first
    let { data, error } = await supabase
      .from('packs')
      .select('id')
      .eq('url_id', id)
      .maybeSingle();

    if (!data && !error) {
      // Try id
      const result = await supabase
        .from('packs')
        .select('id')
        .eq('id', id)
        .maybeSingle();
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('[headHandler] Supabase error:', error);
      return res.status(500).end();
    }

    if (data) {
      res.setHeader('X-Pack-Exists', 'true');
      return res.status(200).end();
    } else {
      res.setHeader('X-Pack-Exists', 'false');
      return res.status(404).end();
    }
  } catch (error) {
    console.error('[headHandler] Unexpected error:', error);
    return res.status(500).end();
  }
}

// ============================================================================
// Vercel config
// ============================================================================
export const config = {
  api: {
    responseLimit: '10mb',
  },
};

// ============================================================================
// Exports for testing
// ============================================================================
export {
  formatPackResponse,
  getCompletePackData
};
