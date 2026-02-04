// /api/search.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { q, type, page = 1, limit = 20 } = req.query;

  try {
    let query = supabase
      .from('packs')
      .select('id, name, version, package_type, views, downloads, created_at')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    // Apply filters
    if (q) {
      query = query.ilike('name', `%${q}%`);
    }
    if (type) {
      query = query.eq('package_type', type);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      packs: data || [],
      page: parseInt(page),
      total: count,
      hasMore: data?.length === limit
    });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
}
