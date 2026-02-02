import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { createHash } from 'crypto'

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// Cookie configuration
const COOKIE_CONFIG = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax', // Changed to lax for better cross-site compatibility
  maxAge: 365 * 24 * 60 * 60, // 1 year for persistent sessions
  path: '/'
}

// Session configuration
const SESSION_CONFIG = {
  maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year in milliseconds
  renewThreshold: 30 * 24 * 60 * 60 * 1000 // Renew if less than 30 days left
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    if (req.method === 'GET') {
      await handleGetSession(req, res)
    } else if (req.method === 'POST') {
      await handleCreateOrUpdateSession(req, res)
    } else if (req.method === 'DELETE') {
      await handleDeleteSession(req, res)
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Session error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleGetSession(req, res) {
  const sessionId = req.cookies?.packcdn_session
  
  if (!sessionId) {
    // No existing session - this is normal for first-time visitors
    return res.status(200).json({ 
      session: null,
      message: 'No existing session found'
    })
  }

  try {
    // Find session by session key
    const { data: session, error } = await supabase
      .from('User_Sessions')
      .select('*')
      .eq('session_key', sessionId)
      .single()

    if (error || !session) {
      // Session not found in DB, but cookie exists - create new session
      console.log('Session not found in DB, creating new one')
      return await createNewAnonymousSession(req, res)
    }

    // Check if session is expired
    if (isSessionExpired(session)) {
      console.log('Session expired, creating new one')
      await supabase
        .from('User_Sessions')
        .delete()
        .eq('session_key', sessionId)
      return await createNewAnonymousSession(req, res)
    }

    // Check if session needs renewal
    if (shouldRenewSession(session)) {
      await renewSession(session.id)
    }

    // Update last active timestamp
    await supabase
      .from('User_Sessions')
      .update({
        last_active: new Date().toISOString(),
        device_info: {
          ...session.device_info,
          last_active: new Date().toISOString(),
          visit_count: (session.device_info?.visit_count || 0) + 1
        }
      })
      .eq('id', session.id)

    // Return session data (excluding sensitive info)
    res.status(200).json({
      session: {
        id: session.id,
        session_key: session.session_key,
        device_fingerprint: session.device_fingerprint,
        created_at: session.created_at,
        expires_at: session.expires_at,
        last_active: session.last_active,
        device_info: {
          browser: session.device_info?.browser,
          os: session.device_info?.os,
          device_type: session.device_info?.device_type,
          visit_count: (session.device_info?.visit_count || 0) + 1
        }
      }
    })
  } catch (error) {
    console.error('Error getting session:', error)
    return await createNewAnonymousSession(req, res)
  }
}

async function handleCreateOrUpdateSession(req, res) {
  // Always create a new anonymous session
  return await createNewAnonymousSession(req, res)
}

async function handleDeleteSession(req, res) {
  const sessionId = req.cookies?.packcdn_session
  
  if (sessionId) {
    // Delete from database
    await supabase
      .from('User_Sessions')
      .delete()
      .eq('session_key', sessionId)
      .catch(error => {
        console.error('Error deleting session:', error)
      })
  }

  // Clear cookies
  clearSessionCookies(res)
  
  res.status(200).json({ 
    success: true, 
    message: 'Session deleted' 
  })
}

// Main function to create anonymous sessions
async function createNewAnonymousSession(req, res) {
  try {
    // Generate unique session key
    const sessionKey = uuidv4()
    
    // Create device fingerprint (anonymous - no personal data)
    const deviceFingerprint = generateDeviceFingerprint(req)
    
    // Calculate expiration
    const expiresAt = new Date(Date.now() + SESSION_CONFIG.maxAge).toISOString()
    const createdAt = new Date().toISOString()
    
    // Prepare device info (anonymous)
    const deviceInfo = {
      browser: getBrowserInfo(req),
      os: getOSInfo(req),
      device_type: getDeviceType(req),
      screen_resolution: req.headers['screen-resolution'] || req.headers['sec-ch-width'] ? 
        `${req.headers['sec-ch-width']}x${req.headers['sec-ch-height']}` : null,
      language: req.headers['accept-language']?.split(',')[0] || 'en-US',
      timezone: req.headers['timezone'] || Intl.DateTimeFormat().resolvedOptions().timeZone,
      visit_count: 1,
      first_seen: createdAt,
      last_active: createdAt,
      user_agent_hash: createHash('sha256').update(req.headers['user-agent'] || '').digest('hex').substring(0, 16)
    }
    
    // Store session in database
    const { data: session, error } = await supabase
      .from('User_Sessions')
      .insert({
        session_key: sessionKey,
        device_fingerprint: deviceFingerprint,
        device_info: deviceInfo,
        expires_at: expiresAt,
        created_at: createdAt,
        last_active: createdAt
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating session:', error)
      throw error
    }

    // Set secure cookies
    setSessionCookies(res, sessionKey)

    // Return session info
    res.status(200).json({
      success: true,
      session: {
        session_key: sessionKey,
        created_at: createdAt,
        expires_at: expiresAt,
        device_info: {
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          device_type: deviceInfo.device_type
        }
      }
    })
  } catch (error) {
    console.error('Error in createNewAnonymousSession:', error)
    res.status(500).json({ 
      error: 'Failed to create session',
      message: error.message 
    })
  }
}

// Helper functions
function generateDeviceFingerprint(req) {
  // Create an anonymous fingerprint using non-PII data
  const components = [
    req.headers['user-agent'] || '',
    req.headers['accept-language']?.split(',')[0] || '',
    req.headers['sec-ch-ua-platform'] || '',
    req.headers['sec-ch-ua-mobile'] || '',
    new Date().getTimezoneOffset().toString()
  ]
  
  const fingerprintString = components.join('|')
  return createHash('sha256').update(fingerprintString).digest('hex')
}

function getBrowserInfo(req) {
  const ua = req.headers['user-agent'] || ''
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Safari')) return 'Safari'
  if (ua.includes('Edge')) return 'Edge'
  return 'Unknown'
}

function getOSInfo(req) {
  const ua = req.headers['user-agent'] || ''
  const platform = req.headers['sec-ch-ua-platform'] || ''
  
  if (platform.includes('Windows')) return 'Windows'
  if (platform.includes('macOS')) return 'macOS'
  if (platform.includes('Linux')) return 'Linux'
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('iOS')) return 'iOS'
  return 'Unknown'
}

function getDeviceType(req) {
  const ua = req.headers['user-agent'] || ''
  const mobile = req.headers['sec-ch-ua-mobile']
  
  if (mobile === '?1') return 'mobile'
  if (ua.includes('Mobile')) return 'mobile'
  if (ua.includes('Tablet')) return 'tablet'
  return 'desktop'
}

function setSessionCookies(res, sessionKey) {
  // HTTP-only secure cookie (server-side only)
  const secureCookie = `packcdn_session=${sessionKey}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${COOKIE_CONFIG.maxAge}`
  
  // JS-accessible cookie (for client-side updates)
  const jsCookie = `packcdn_session_js=${sessionKey}; Path=/; Max-Age=${COOKIE_CONFIG.maxAge}; SameSite=Lax`
  
  // Add domain if in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Set-Cookie', [
      secureCookie + '; Domain=.pack-cdn.vercel.app', // Use your domain
      jsCookie + '; Domain=.pack-cdn.vercel.app
    ])
  } else {
    res.setHeader('Set-Cookie', [secureCookie, jsCookie])
  }
}

function clearSessionCookies(res) {
  const cookies = [
    'packcdn_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
    'packcdn_session_js=; Path=/; Max-Age=0; SameSite=Lax'
  ]
  
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Set-Cookie', cookies.map(cookie => cookie + '; Domain=.pack-cdn.vercel.app'))
  } else {
    res.setHeader('Set-Cookie', cookies)
  }
}

function isSessionExpired(session) {
  if (!session.expires_at) return true
  return new Date(session.expires_at) < new Date()
}

function shouldRenewSession(session) {
  if (!session.expires_at) return true
  const expiresAt = new Date(session.expires_at).getTime()
  const timeLeft = expiresAt - Date.now()
  return timeLeft < SESSION_CONFIG.renewThreshold
}

async function renewSession(sessionId) {
  const newExpiresAt = new Date(Date.now() + SESSION_CONFIG.maxAge).toISOString()
  
  await supabase
    .from('User_Sessions')
    .update({
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionId)
    .catch(error => {
      console.error('Error renewing session:', error)
    })
}

// Middleware for automatic session creation
export async function autoSessionMiddleware(req, res, next) {
  // Check for existing session
  const sessionId = req.cookies?.packcdn_session
  
  if (!sessionId) {
    // Auto-create session for new visitors
    try {
      const response = await fetch(`${req.headers.origin || 'http://localhost:3000'}/api/session-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': req.headers.cookie || ''
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        req.packcdnSession = data.session?.session_key
      }
    } catch (error) {
      console.error('Auto-session creation failed:', error)
    }
  } else {
    req.packcdnSession = sessionId
  }
  
  next()
}
