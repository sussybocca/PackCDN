import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Enhanced pack response formatter (unchanged)
function formatPackResponse(pack, metadata = null, versions = [], dependencies = [], collaborators = [], changes = []) {
  // ... (your existing code, unchanged)
}

// Helper to get all pack data (improved error handling)
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

// Main handler (improved error responses)
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

// HEAD handler (unchanged, but could use same improved logic)
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

export const config = {
  api: {
    responseLimit: '10mb',
  },
};

export {
  formatPackResponse,
  getCompletePackData
};
