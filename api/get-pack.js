import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Enhanced pack response formatter
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

// Helper to get all pack data
async function getCompletePackData(packId, includeAdvanced = true) {
  try {
    // Get main pack data - now matches by either id OR url_id
    let { data: pack, error: packError } = await supabase
      .from('packs')
      .select('*')
      .or(`id.eq.${packId},url_id.eq.${packId}`)
      .single();
    
    if (packError || !pack) {
      return { error: 'Pack not found' };
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
      const promises = [
        // Get metadata
        supabase
          .from('pack_metadata')
          .select('*')
          .eq('pack_id', pack.id)
          .single(),
        
        // Get versions
        supabase
          .from('pack_versions')
          .select('*')
          .eq('pack_id', pack.id)
          .order('version_number', { ascending: false }),
        
        // Get dependencies
        supabase
          .from('pack_dependencies')
          .select('dependency_name')
          .eq('pack_id', pack.id),
        
        // Get collaborators
        supabase
          .from('pack_collaborators')
          .select('*')
          .eq('pack_id', pack.id)
          .order('created_at', { ascending: false }),
        
        // Get recent changes
        supabase
          .from('pack_changes')
          .select('*')
          .eq('pack_id', pack.id)
          .order('created_at', { ascending: false })
          .limit(10)
      ];
      
      const [
        metadataResult,
        versionsResult,
        dependenciesResult,
        collaboratorsResult,
        changesResult
      ] = await Promise.allSettled(promises);
      
      // Process results
      if (metadataResult.status === 'fulfilled' && metadataResult.value.data) {
        results.metadata = metadataResult.value.data;
      }
      
      if (versionsResult.status === 'fulfilled' && versionsResult.value.data) {
        results.versions = versionsResult.value.data;
      }
      
      if (dependenciesResult.status === 'fulfilled' && dependenciesResult.value.data) {
        results.dependencies = dependenciesResult.value.data;
      }
      
      if (collaboratorsResult.status === 'fulfilled' && collaboratorsResult.value.data) {
        results.collaborators = collaboratorsResult.value.data;
      }
      
      if (changesResult.status === 'fulfilled' && changesResult.value.data) {
        results.changes = changesResult.value.data;
      }
    }
    
    // Increment view count
    await supabase
      .from('packs')
      .update({ 
        views: (pack.views || 0) + 1,
        last_accessed: new Date().toISOString()
      })
      .eq('id', pack.id);
    
    return results;
    
  } catch (error) {
    console.error('Error getting complete pack data:', error);
    return { error: error.message };
  }
}

// Main handler
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
    console.log(`Looking for pack with ID: ${id}`);
    
    // Get complete pack data
    const includeAdvancedData = includeAdvanced !== 'false';
    const packData = await getCompletePackData(id, includeAdvancedData);
    
    if (packData.error) {
      return res.status(404).json({ 
        success: false,
        error: packData.error === 'Pack not found' ? 'Pack not found' : 'Failed to fetch pack data',
        code: packData.error === 'Pack not found' ? 'PACK_NOT_FOUND' : 'FETCH_ERROR',
        debug: `No pack found with ID: ${id}`
      });
    }
    
    const { pack, metadata, versions, dependencies, collaborators, changes } = packData;
    
    console.log(`Found pack: ${pack.name} (${pack.id})`);
    console.log(`- Package type: ${pack.package_type}`);
    console.log(`- Versions: ${versions.length}`);
    console.log(`- Dependencies: ${dependencies.length}`);
    console.log(`- WASM generated: ${!!pack.wasm_url}`);
    console.log(`- Complex WASM: ${!!pack.complex_wasm_url}`);
    
    // Format response
    const response = formatPackResponse(
      pack, 
      metadata, 
      versions, 
      dependencies, 
      collaborators, 
      changes
    );
    
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120');
    
    // Return formatted response
    res.status(200).json(response);
    
  } catch (error) {
    console.error('Get pack error:', {
      message: error.message,
      stack: error.stack,
      query: req.query,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to get pack',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Optional: Add support for HEAD requests to check existence
export async function headHandler(req, res) {
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).end();
  }
  
  try {
    const { data } = await supabase
      .from('packs')
      .select('id')
      .or(`id.eq.${id},url_id.eq.${id}`)
      .single();
    
    if (data) {
      res.setHeader('X-Pack-Exists', 'true');
      return res.status(200).end();
    } else {
      res.setHeader('X-Pack-Exists', 'false');
      return res.status(404).end();
    }
  } catch (error) {
    console.error('HEAD request error:', error);
    return res.status(500).end();
  }
}

// Optional: Add support for query parameters to filter response
export const config = {
  api: {
    responseLimit: '10mb', // Allow larger responses for WASM packages
  },
};

// Export helper functions for testing
export {
  formatPackResponse,
  getCompletePackData
};
