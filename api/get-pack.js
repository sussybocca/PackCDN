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
    
    // Try to find by url_id first (short ID like "h3auoju5jztml4adqdt")
    // If not found, try by id (UUID)
    const { data, error } = await supabase
      .from('packs')
      .select('*')
      .or(`url_id.eq.${id},id.eq.${id}`) // Search by both url_id AND id
      .single();

    if (error) {
      console.error('Supabase error:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({ 
          success: false,
          error: 'Pack not found',
          debug: `No pack found with ID: ${id}`
        });
      }
      throw error;
    }

    if (!data) {
      return res.status(404).json({ 
        success: false,
        error: 'Pack not found',
        debug: `No data returned for ID: ${id}`
      });
    }

    console.log(`Found pack: ${data.name || data.id}, url_id: ${data.url_id}`);
    
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
