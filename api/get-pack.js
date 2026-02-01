import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing pack ID' });
  }

  try {
    console.log(`Looking for pack with ID: ${id}`);
    
    // First try to find by url_id (short ID)
    let { data, error } = await supabase
      .from('packs')
      .select('*')
      .eq('url_id', id)
      .single();

    // If not found by url_id, try by id (UUID)
    if (error && error.code === 'PGRST116') {
      console.log(`Not found by url_id, trying by UUID id: ${id}`);
      const { data: uuidData, error: uuidError } = await supabase
        .from('packs')
        .select('*')
        .eq('id', id)
        .single();

      if (uuidError) {
        if (uuidError.code === 'PGRST116') {
          return res.status(404).json({ 
            success: false,
            error: 'Pack not found',
            debug: `No pack found with ID: ${id}`
          });
        }
        throw uuidError;
      }
      
      data = uuidData;
      console.log(`Found pack by UUID: ${data.name || data.id}`);
    } else if (error) {
      throw error;
    } else {
      console.log(`Found pack by url_id: ${data.name || data.id}`);
    }

    if (!data) {
      return res.status(404).json({ 
        success: false,
        error: 'Pack not found',
        debug: `No data returned for ID: ${id}`
      });
    }

    console.log(`Pack details - Name: ${data.name}, url_id: ${data.url_id}, id: ${data.id}`);
    
    // Parse pack_json if it's a string
    let packJson = data.pack_json;
    if (typeof packJson === 'string') {
      try {
        packJson = JSON.parse(packJson);
      } catch (e) {
        console.warn('Failed to parse pack_json:', e);
      }
    }

    // Return the pack data
    res.status(200).json({
      success: true,
      pack: {
        ...data,
        pack_json: packJson
      }
    });
  } catch (error) {
    console.error('Get pack error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get pack: ' + error.message,
      debug: 'Check server logs for details'
    });
  }
}
