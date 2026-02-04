// /api/Pages/Explore/explore-pages.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  try {
    const { 
      page = 1, 
      limit = 20, 
      sort = 'newest',
      search = '',
      tag = '',
      type = ''
    } = req.query
    
    const pageNum = parseInt(page)
    const limitNum = Math.min(parseInt(limit), 100)
    const offset = (pageNum - 1) * limitNum
    
    // Build query - FIXED: Use 'user_pages' (lowercase) to match your database
    let query = supabase
      .from('user_pages')
      .select('*', { count: 'exact' })
      .eq('is_public', true)
    
    // Apply filters
    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%,page_id.ilike.%${search}%`)
    }
    
    if (tag) {
      query = query.contains('tags', [tag])
    }
    
    if (type && type !== 'all') {
      query = query.eq('page_type', type)
    }
    
    // Apply sorting
    switch(sort) {
      case 'popular':
        query = query.order('views', { ascending: false })
        break
      case 'likes':
        query = query.order('likes', { ascending: false })
        break
      case 'oldest':
        query = query.order('created_at', { ascending: true })
        break
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false })
        break
    }
    
    // Add pagination
    query = query.range(offset, offset + limitNum - 1)
    
    // Execute query
    const { data: pages, error, count } = await query
    
    if (error) throw error
    
    // Get tags for filter
    const { data: allTags } = await supabase
      .from('user_pages')
      .select('tags')
      .eq('is_public', true)
    
    const uniqueTags = [...new Set(allTags?.flatMap(p => p.tags || []))].filter(Boolean)
    
    // Get stats
    const { count: totalCount } = await supabase
      .from('user_pages')
      .select('*', { count: 'exact', head: true })
      .eq('is_public', true)
    
    const { data: topPages } = await supabase
      .from('user_pages')
      .select('page_id, title, views, created_at')
      .eq('is_public', true)
      .order('views', { ascending: false })
      .limit(5)
    
    // Return HTML page for browser, JSON for API
    const accept = req.headers.accept || ''
    
    if (accept.includes('text/html')) {
      return res.send(renderExplorePage({
        pages,
        totalCount,
        pageNum,
        limitNum,
        sort,
        search,
        tag,
        type,
        uniqueTags,
        topPages
      }))
    } else {
      return res.json({
        success: true,
        data: pages,
        meta: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limitNum),
          sort,
          filters: { search, tag, type }
        },
        stats: {
          totalPages: totalCount || 0,
          uniqueTags: uniqueTags.length,
          topPages: topPages || []
        }
      })
    }
    
  } catch (error) {
    console.error('Explore pages error:', error)
    return res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fetch pages'
    })
  }
}

function renderExplorePage(data) {
  const {
    pages = [],
    totalCount = 0,
    pageNum = 1,
    limitNum = 20,
    sort = 'newest',
    search = '',
    tag = '',
    type = '',
    uniqueTags = [],
    topPages = []
  } = data
  
  const totalPages = Math.ceil(totalCount / limitNum)
  
  // Helper function to escape HTML
  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  
  // Helper function to truncate text
  function truncate(text, length) {
    if (!text) return '';
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  }
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Explore User Pages | Pack CDN</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            color: white;
        }
        
        .header h1 {
            font-size: 3rem;
            margin-bottom: 10px;
            text-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }
        
        .header p {
            font-size: 1.2rem;
            opacity: 0.9;
        }
        
        .main-content {
            display: grid;
            grid-template-columns: 300px 1fr;
            gap: 30px;
        }
        
        @media (max-width: 1024px) {
            .main-content {
                grid-template-columns: 1fr;
            }
        }
        
        /* Filters Sidebar */
        .sidebar {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 15px 40px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
            height: fit-content;
            position: sticky;
            top: 20px;
        }
        
        .filter-group {
            margin-bottom: 30px;
        }
        
        .filter-title {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 15px;
            color: #444;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .search-box {
            width: 100%;
            padding: 15px;
            border: 2px solid #e0e0e0;
            border-radius: 12px;
            font-size: 1rem;
            transition: all 0.3s;
            margin-bottom: 20px;
        }
        
        .search-box:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .sort-options {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .sort-option {
            padding: 12px 20px;
            background: white;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.3s;
            text-align: left;
            font-size: 0.95rem;
        }
        
        .sort-option:hover {
            border-color: #667eea;
            background: #f8f9ff;
        }
        
        .sort-option.active {
            background: #667eea;
            color: white;
            border-color: #667eea;
        }
        
        .tag-cloud {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        
        .tag {
            padding: 8px 16px;
            background: #f0f2ff;
            border: 1px solid #d0d7ff;
            border-radius: 20px;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .tag:hover, .tag.active {
            background: #667eea;
            color: white;
            border-color: #667eea;
        }
        
        .type-filter {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        }
        
        .type-btn {
            padding: 10px;
            background: white;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            cursor: pointer;
            text-align: center;
            font-size: 0.9rem;
            transition: all 0.3s;
        }
        
        .type-btn:hover, .type-btn.active {
            background: #667eea;
            color: white;
            border-color: #667eea;
        }
        
        /* Pages Grid */
        .pages-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 25px;
        }
        
        .page-card {
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            transition: all 0.3s;
            height: 100%;
            display: flex;
            flex-direction: column;
        }
        
        .page-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 40px rgba(0,0,0,0.15);
        }
        
        .card-header {
            padding: 25px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .page-title {
            font-size: 1.4rem;
            margin-bottom: 10px;
            line-height: 1.3;
        }
        
        .page-id {
            font-size: 0.9rem;
            opacity: 0.9;
            font-family: monospace;
        }
        
        .card-body {
            padding: 25px;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
        }
        
        .page-preview {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
            flex-grow: 1;
            overflow: hidden;
        }
        
        .page-preview-content {
            max-height: 150px;
            overflow: hidden;
            line-height: 1.5;
            color: #555;
        }
        
        .page-stats {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
            font-size: 0.9rem;
            color: #666;
        }
        
        .stat {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .card-footer {
            padding: 0 25px 25px;
            display: flex;
            gap: 10px;
        }
        
        .btn {
            padding: 10px 20px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s;
            flex: 1;
            text-align: center;
        }
        
        .btn-primary {
            background: #667eea;
            color: white;
        }
        
        .btn-primary:hover {
            background: #5a67d8;
        }
        
        .btn-secondary {
            background: #f8f9fa;
            color: #333;
            border: 2px solid #e0e0e0;
        }
        
        .btn-secondary:hover {
            background: #e9ecef;
        }
        
        /* Pagination */
        .pagination {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin-top: 40px;
            flex-wrap: wrap;
        }
        
        .page-btn {
            padding: 10px 18px;
            background: white;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .page-btn:hover {
            border-color: #667eea;
            color: #667eea;
        }
        
        .page-btn.active {
            background: #667eea;
            color: white;
            border-color: #667eea;
        }
        
        /* Stats */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .stat-card {
            background: rgba(255, 255, 255, 0.9);
            border-radius: 15px;
            padding: 25px;
            text-align: center;
            backdrop-filter: blur(10px);
        }
        
        .stat-number {
            font-size: 2.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }
        
        .stat-label {
            color: #666;
            font-size: 0.95rem;
        }
        
        /* Empty State */
        .empty-state {
            text-align: center;
            padding: 80px 20px;
            background: white;
            border-radius: 20px;
            grid-column: 1 / -1;
        }
        
        .empty-icon {
            font-size: 4rem;
            margin-bottom: 20px;
            opacity: 0.3;
        }
        
        /* Top Pages */
        .top-pages {
            margin-top: 40px;
            padding: 25px;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 20px;
        }
        
        .top-pages-title {
            font-size: 1.3rem;
            margin-bottom: 20px;
            color: #444;
        }
        
        .top-page-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            background: white;
            border-radius: 10px;
            margin-bottom: 10px;
            transition: all 0.3s;
        }
        
        .top-page-item:hover {
            transform: translateX(5px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .action-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            flex-wrap: wrap;
            gap: 15px;
        }
        
        .create-btn {
            padding: 15px 30px;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            border: none;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s;
        }
        
        .create-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(245, 87, 108, 0.3);
        }
        
        @media (max-width: 768px) {
            .pages-grid {
                grid-template-columns: 1fr;
            }
            
            .header h1 {
                font-size: 2.2rem;
            }
            
            .type-filter {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✨ Explore User Pages</h1>
            <p>Discover amazing pages created by the Pack CDN community</p>
        </div>
        
        <div class="action-bar">
            <div>
                <a href="/" class="btn btn-secondary">🏠 Home</a>
                <a href="@random" class="create-btn">✨ Create Your Page</a>
            </div>
            <div class="stat-card" style="padding: 15px 25px;">
                <div style="font-size: 1.5rem; font-weight: 700; color: #667eea;">${totalCount}</div>
                <div style="color: #666;">Total Pages</div>
            </div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${pages.length}</div>
                <div class="stat-label">Displayed Pages</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${uniqueTags.length}</div>
                <div class="stat-label">Unique Tags</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${Math.ceil(totalCount / limitNum)}</div>
                <div class="stat-label">Total Pages</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${topPages.reduce((sum, p) => sum + (p.views || 0), 0).toLocaleString()}</div>
                <div class="stat-label">Total Views</div>
            </div>
        </div>
        
        <div class="main-content">
            <!-- Sidebar Filters -->
            <div class="sidebar">
                <input 
                    type="text" 
                    class="search-box" 
                    placeholder="Search pages..." 
                    value="${escapeHtml(search)}"
                    onkeyup="if(event.key==='Enter') searchPages()"
                    id="searchInput"
                >
                
                <div class="filter-group">
                    <div class="filter-title">📊 Sort By</div>
                    <div class="sort-options">
                        <button class="sort-option ${sort === 'newest' ? 'active' : ''}" onclick="setSort('newest')">
                            🆕 Newest First
                        </button>
                        <button class="sort-option ${sort === 'oldest' ? 'active' : ''}" onclick="setSort('oldest')">
                            📅 Oldest First
                        </button>
                        <button class="sort-option ${sort === 'popular' ? 'active' : ''}" onclick="setSort('popular')">
                            🔥 Most Popular
                        </button>
                        <button class="sort-option ${sort === 'likes' ? 'active' : ''}" onclick="setSort('likes')">
                            ❤️ Most Liked
                        </button>
                    </div>
                </div>
                
                <div class="filter-group">
                    <div class="filter-title">🏷️ Filter by Tag</div>
                    <div class="tag-cloud">
                        <button class="tag ${!tag ? 'active' : ''}" onclick="setTag('')">
                            All Tags
                        </button>
                        ${uniqueTags.slice(0, 20).map(t => `
                            <button class="tag ${tag === t ? 'active' : ''}" onclick="setTag('${escapeHtml(t)}')">
                                ${escapeHtml(t)}
                            </button>
                        `).join('')}
                        ${uniqueTags.length > 20 ? `
                            <button class="tag" onclick="showAllTags()">
                                +${uniqueTags.length - 20} more...
                            </button>
                        ` : ''}
                    </div>
                </div>
                
                <div class="filter-group">
                    <div class="filter-title">📄 Page Type</div>
                    <div class="type-filter">
                        <button class="type-btn ${!type ? 'active' : ''}" onclick="setType('')">
                            All Types
                        </button>
                        <button class="type-btn ${type === 'html' ? 'active' : ''}" onclick="setType('html')">
                            HTML
                        </button>
                        <button class="type-btn ${type === 'embed' ? 'active' : ''}" onclick="setType('embed')">
                            Embed
                        </button>
                        <button class="type-btn ${type === 'markdown' ? 'active' : ''}" onclick="setType('markdown')">
                            Markdown
                        </button>
                        <button class="type-btn ${type === 'dashboard' ? 'active' : ''}" onclick="setType('dashboard')">
                            Dashboard
                        </button>
                    </div>
                </div>
                
                <button class="btn btn-primary" style="width: 100%; margin-top: 20px;" onclick="applyFilters()">
                    🔍 Apply Filters
                </button>
                
                <button class="btn btn-secondary" style="width: 100%; margin-top: 10px;" onclick="resetFilters()">
                    🔄 Reset
                </button>
            </div>
            
            <!-- Pages Grid -->
            <div>
                ${pages.length === 0 ? `
                    <div class="empty-state">
                        <div class="empty-icon">📄</div>
                        <h2 style="margin-bottom: 10px; color: #666;">No pages found</h2>
                        <p style="color: #888; margin-bottom: 30px;">
                            ${search || tag || type ? 'Try changing your filters' : 'Be the first to create a page!'}
                        </p>
                        <a href="@random" class="create-btn">✨ Create First Page</a>
                    </div>
                ` : `
                    <div class="pages-grid">
                        ${pages.map(page => {
                          const pageTitle = page.title || 'Untitled Page';
                          const pageId = page.page_id || '';
                          const pageContent = page.content || '';
                          const pageType = page.page_type || 'html';
                          const pageTags = page.tags || [];
                          const pageViews = page.views || 0;
                          const pageLikes = page.likes || 0;
                          const createdDate = page.created_at ? new Date(page.created_at).toLocaleDateString() : 'Unknown';
                          
                          return `
                            <div class="page-card">
                                <div class="card-header">
                                    <div class="page-title">${escapeHtml(pageTitle)}</div>
                                    <div class="page-id">@${escapeHtml(pageId)}</div>
                                </div>
                                <div class="card-body">
                                    <div class="page-preview">
                                        <div class="page-preview-content">
                                            ${pageType === 'embed' 
                                                ? `🌐 Embedded: ${truncate(escapeHtml(pageContent), 100)}` 
                                                : truncate(escapeHtml(pageContent), 200)}
                                        </div>
                                    </div>
                                    <div class="page-stats">
                                        <div class="stat">👁️ ${pageViews}</div>
                                        <div class="stat">❤️ ${pageLikes}</div>
                                        <div class="stat">📅 ${createdDate}</div>
                                        <div class="stat">🏷️ ${escapeHtml(pageType)}</div>
                                    </div>
                                    ${pageTags.length > 0 ? `
                                        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 15px;">
                                            ${pageTags.slice(0, 3).map(t => `
                                                <span style="background: #f0f2ff; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; color: #667eea;">
                                                    ${escapeHtml(t)}
                                                </span>
                                            `).join('')}
                                            ${pageTags.length > 3 ? `
                                                <span style="background: #f0f2ff; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; color: #888;">
                                                    +${pageTags.length - 3}
                                                </span>
                                            ` : ''}
                                        </div>
                                    ` : ''}
                                </div>
                                <div class="card-footer">
                                    <a href="@${escapeHtml(pageId)}" class="btn btn-primary">Visit Page</a>
                                    <button class="btn btn-secondary" onclick="likePage('${escapeHtml(pageId)}')">❤️ Like</button>
                                </div>
                            </div>
                          `;
                        }).join('')}
                    </div>
                    
                    ${totalPages > 1 ? `
                        <div class="pagination">
                            ${pageNum > 1 ? `
                                <button class="page-btn" onclick="goToPage(${pageNum - 1})">← Previous</button>
                            ` : ''}
                            
                            ${Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageToShow = i + 1;
                                if (totalPages > 5) {
                                    if (pageNum <= 3) pageToShow = i + 1;
                                    else if (pageNum >= totalPages - 2) pageToShow = totalPages - 4 + i;
                                    else pageToShow = pageNum - 2 + i;
                                }
                                return pageToShow <= totalPages ? `
                                    <button class="page-btn ${pageNum === pageToShow ? 'active' : ''}" 
                                            onclick="goToPage(${pageToShow})">
                                        ${pageToShow}
                                    </button>
                                ` : '';
                            }).join('')}
                            
                            ${pageNum < totalPages ? `
                                <button class="page-btn" onclick="goToPage(${pageNum + 1})">Next →</button>
                            ` : ''}
                        </div>
                    ` : ''}
                `}
                
                ${topPages.length > 0 ? `
                    <div class="top-pages">
                        <div class="top-pages-title">🔥 Trending Pages</div>
                        ${topPages.map(page => {
                          const pageTitle = page.title || 'Untitled';
                          const pageId = page.page_id || '';
                          const pageViews = page.views || 0;
                          return `
                            <div class="top-page-item">
                                <div>
                                    <div style="font-weight: 600;">${escapeHtml(pageTitle)}</div>
                                    <div style="font-size: 0.9rem; color: #666;">@${escapeHtml(pageId)} • ${pageViews} views</div>
                                </div>
                                <div>
                                    <a href="@${escapeHtml(pageId)}" class="btn btn-primary" style="padding: 8px 16px; font-size: 0.9rem;">
                                        Visit
                                    </a>
                                </div>
                            </div>
                          `;
                        }).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    </div>
    
    <script>
        let currentFilters = {
            page: ${pageNum},
            limit: ${limitNum},
            sort: '${escapeHtml(sort)}',
            search: '${escapeHtml(search)}',
            tag: '${escapeHtml(tag)}',
            type: '${escapeHtml(type)}'
        }
        
        function updateURL() {
            const params = new URLSearchParams()
            Object.entries(currentFilters).forEach(([key, value]) => {
                if (value) params.set(key, value)
            })
            const url = '/api/Pages/Explore/explore-pages' + (params.toString() ? '?' + params.toString() : '')
            window.history.pushState({}, '', url)
        }
        
        function applyFilters() {
            currentFilters.search = document.getElementById('searchInput').value
            currentFilters.page = 1
            updateURL()
            window.location.reload()
        }
        
        function setSort(sortBy) {
            currentFilters.sort = sortBy
            currentFilters.page = 1
            updateURL()
            window.location.reload()
        }
        
        function setTag(selectedTag) {
            currentFilters.tag = selectedTag
            currentFilters.page = 1
            updateURL()
            window.location.reload()
        }
        
        function setType(selectedType) {
            currentFilters.type = selectedType
            currentFilters.page = 1
            updateURL()
            window.location.reload()
        }
        
        function resetFilters() {
            currentFilters = {
                page: 1,
                limit: ${limitNum},
                sort: 'newest',
                search: '',
                tag: '',
                type: ''
            }
            updateURL()
            window.location.reload()
        }
        
        function goToPage(page) {
            currentFilters.page = page
            updateURL()
            window.location.reload()
        }
        
        function searchPages() {
            applyFilters()
        }
        
        function showAllTags() {
            alert('All tags: ${uniqueTags.map(t => escapeHtml(t)).join(', ')}')
        }
        
        async function likePage(pageId) {
            try {
                const response = await fetch('/api/create-page', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Action': 'like'
                    },
                    body: JSON.stringify({ page_id: pageId })
                })
                
                const data = await response.json();
                
                if (response.ok) {
                    alert('Page liked! ❤️')
                    // Refresh to show updated likes
                    window.location.reload()
                } else {
                    alert(data.error || 'Failed to like page')
                }
            } catch (error) {
                alert('Failed to like page: ' + error.message)
            }
        }
        
        // Handle Enter key in search
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchPages()
        })
        
        // Auto-focus search on page load
        window.addEventListener('load', () => {
            if (currentFilters.search) {
                document.getElementById('searchInput').focus()
                document.getElementById('searchInput').select()
            }
        })
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault()
                document.getElementById('searchInput').focus()
                document.getElementById('searchInput').select()
            }
            if (e.key === 'Escape' && document.getElementById('searchInput') === document.activeElement) {
                document.getElementById('searchInput').value = ''
            }
        })
    </script>
</body>
</html>
  `
}
