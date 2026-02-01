// /api/get-pack.js
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
    // Get pack from Supabase
    const { data, error } = await supabase
      .from('packs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Pack not found' });
      }
      throw error;
    }

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
    res.status(500).json({ error: 'Failed to get pack' });
  }
}
