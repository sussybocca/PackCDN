// /api/admin/database.js - REPLACE THE ENTIRE FILE WITH THIS:

import { createClient } from '@supabase/supabase-js'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import crypto from 'crypto'

// Security middleware wrapper
const withSecurity = (handler) => async (req, res) => {
  try {
    // Apply Helmet security headers
    await new Promise((resolve) => {
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        }
      })(req, res, resolve)
    })

    // 1. Get environment variables
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    // Verify all required secrets are present
    if (!ADMIN_PASSWORD || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Missing required environment variables')
      return res.status(500).json({ 
        error: 'Server configuration error',
        firewall: 'active'
      })
    }

    // 2. IP-based firewall with hashed validation
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip
    
    // Get timestamp from request
    const timestamp = req.body?.timestamp || ''
    
    // Parse IP validation from request headers - FRONTEND IS SENDING: SHA256(password + timestamp.slice(0, 10))
    const requestIPHash = req.headers['x-ip-validator']
    
    // Generate expected hash: SHA256(ADMIN_PASSWORD + timestamp.slice(0, 10))
    const expectedIPHash = crypto
      .createHash('sha256')
      .update(ADMIN_PASSWORD + timestamp.slice(0, 10))
      .digest('hex')
      .slice(0, 32) // Frontend sends 32 chars

    console.log('🔐 IP VALIDATOR DEBUG:', {
      received: requestIPHash?.substring(0, 8) + '...',
      expected: expectedIPHash.substring(0, 8) + '...',
      password: ADMIN_PASSWORD?.substring(0, 3) + '...',
      timestampSlice: timestamp.slice(0, 10),
      formula: 'SHA256(password + timestamp.slice(0, 10))'
    })

    // Enhanced IP validation
    if (!requestIPHash || requestIPHash !== expectedIPHash) {
      console.warn(`🚨 Firewall blocked: Invalid IP validator from ${clientIP}`)
      console.warn(`Expected (first 16): ${expectedIPHash.substring(0, 16)}`)
      console.warn(`Received (first 16): ${requestIPHash?.substring(0, 16) || 'none'}`)
      
      // Log potential attack attempt
      const attackLog = {
        timestamp: new Date().toISOString(),
        ip: clientIP,
        userAgent: req.headers['user-agent'],
        attemptedAction: req.body?.action || 'unknown'
      }
      console.warn('Potential attack:', attackLog)
      
      return res.status(403).json({ 
        error: 'Firewall violation - Invalid request signature',
        timestamp: new Date().toISOString(),
        firewall: 'high-security',
        hint: 'IP validator must be SHA256(password + YYYY-MM-DD)'
      })
    }

    // 3. Rate Limiting with express-rate-limit
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // 10 requests per window
      message: { 
        error: 'Rate limit exceeded',
        firewall: 'active',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        // Use IP + user agent for rate limiting
        const userAgent = req.headers['user-agent'] || 'unknown'
        return `${clientIP}-${crypto.createHash('md5').update(userAgent).digest('hex')}`
      },
      handler: (req, res) => {
        console.warn(`🚨 Rate limit exceeded for IP: ${clientIP}`)
        res.status(429).json({
          error: 'Too many requests',
          firewall: 'rate-limit',
          retryAfter: '15 minutes'
        })
      }
    })

    // Apply rate limiting
    await new Promise((resolve, reject) => {
      limiter(req, res, (result) => {
        if (result instanceof Error) reject(result)
        resolve(result)
      })
    })

    // 4. Request validation
    if (req.method !== 'POST') {
      return res.status(405).json({ 
        error: 'Method not allowed',
        allowedMethods: ['POST']
      })
    }

    const { password, timestamp: bodyTimestamp, signature, action } = req.body

    if (!password || !bodyTimestamp || !signature || !action) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['password', 'timestamp', 'signature', 'action']
      })
    }

    // 5. Timestamp validation (prevent replay attacks)
    const requestTime = new Date(bodyTimestamp).getTime()
    const currentTime = Date.now()
    const timeDiff = Math.abs(currentTime - requestTime)
    
    if (isNaN(requestTime) || timeDiff > 5 * 60 * 1000) { // 5 minute window
      return res.status(401).json({ 
        error: 'Request expired or invalid timestamp',
        maxWindow: '5 minutes'
      })
    }

    // 6. Signature validation with HMAC
    const expectedSignature = crypto
      .createHmac('sha256', ADMIN_PASSWORD)
      .update(`${password}:${bodyTimestamp}:${action}:${SUPABASE_URL}`)
      .digest('hex')

    console.log('🔐 SIGNATURE DEBUG:', {
      received: signature.substring(0, 16) + '...',
      expected: expectedSignature.substring(0, 16) + '...',
      matches: signature === expectedSignature
    })

    if (signature !== expectedSignature) {
      console.warn(`🚨 Invalid signature from IP: ${clientIP}`)
      return res.status(401).json({ 
        error: 'Invalid request signature',
        firewall: 'signature-validation'
      })
    }

    // 7. Password validation
    if (password !== ADMIN_PASSWORD) {
      console.warn(`🚨 Failed password attempt from IP: ${clientIP}`)
      return res.status(401).json({ 
        error: 'Unauthorized access',
        firewall: 'password-validation'
      })
    }

    // 8. Create Supabase client with service role key
    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        },
        global: {
          headers: {
            'X-Client-IP': clientIP,
            'X-Admin-Access': 'true'
          }
        }
      }
    )

    // 9. All security checks passed - proceed to handler
    console.log(`✅ Secure access granted for action: ${action} from IP: ${clientIP}`)
    return handler(req, res, supabase, clientIP)

  } catch (error) {
    console.error('❌ Security middleware error:', error)
    return res.status(500).json({ 
      error: 'Security check failed',
      details: 'Internal server error',
      firewall: 'error'
    })
  }
}

// Main handler with full database management
export default withSecurity(async (req, res, supabase, clientIP) => {
  try {
    const { action, table, data, query, id, limit = 1000 } = req.body

    // Additional action validation
    const validActions = ['GET_ALL_TABLES', 'GET_TABLE', 'INSERT', 'UPDATE', 'DELETE', 'RAW_SQL', 'EXECUTE_FUNCTION']
    if (!validActions.includes(action)) {
      return res.status(400).json({ 
        error: 'Invalid action',
        validActions: validActions 
      })
    }

    switch (action) {
      case 'GET_ALL_TABLES':
        // Get all tables from information_schema
        const { data: tables, error: tablesError } = await supabase
          .from('information_schema.tables')
          .select('table_name, table_type')
          .eq('table_schema', 'public')
          .order('table_name')

        if (tablesError) {
          console.error('Tables fetch error:', tablesError)
          return res.status(500).json({ 
            error: 'Failed to fetch tables',
            details: tablesError.message 
          })
        }

        // Fetch sample data from each table
        const allTablesData = {}
        const tableStats = {}
        
        for (const tableInfo of tables) {
          const tableName = tableInfo.table_name
          try {
            const { data: tableData, error: tableError, count } = await supabase
              .from(tableName)
              .select('*', { count: 'exact', head: true })
              .limit(1)

            if (!tableError) {
              tableStats[tableName] = {
                type: tableInfo.table_type,
                estimatedRows: count || 0,
                sampled: tableData ? tableData.length : 0
              }
              
              // Get full data for smaller tables
              if (count && count <= limit) {
                const { data: fullData } = await supabase
                  .from(tableName)
                  .select('*')
                  .limit(limit)
                allTablesData[tableName] = fullData || []
              }
            }
          } catch (err) {
            console.warn(`Could not fetch table ${tableName}:`, err.message)
          }
        }

        return res.json({
          success: true,
          timestamp: new Date().toISOString(),
          ip: clientIP,
          tables: tables.map(t => t.table_name),
          stats: tableStats,
          data: allTablesData,
          limit: limit,
          supabaseUrl: process.env.SUPABASE_URL?.replace(/\/\/(.*?)\.supabase\.co/, '//***.supabase.co') // Masked
        })

      case 'GET_TABLE':
        if (!table) {
          return res.status(400).json({ error: 'Table name required' })
        }

        const { data: tableData, error: tableError, count } = await supabase
          .from(table)
          .select('*', { count: 'exact' })
          .limit(limit)

        if (tableError) {
          console.error(`Table ${table} fetch error:`, tableError)
          return res.status(500).json({ 
            error: `Failed to fetch table: ${table}`,
            details: tableError.message 
          })
        }

        return res.json({
          success: true,
          table: table,
          count: count || 0,
          data: tableData,
          limit: limit,
          ip: clientIP
        })

      case 'INSERT':
        if (!table || !data) {
          return res.status(400).json({ error: 'Table and data required' })
        }

        // Validate data structure
        if (!Array.isArray(data)) {
          return res.status(400).json({ error: 'Data must be an array' })
        }

        const { data: inserted, error: insertError } = await supabase
          .from(table)
          .insert(data)
          .select()

        if (insertError) {
          console.error(`Insert error for table ${table}:`, insertError)
          return res.status(500).json({ 
            error: 'Insert failed',
            details: insertError.message,
            table: table
          })
        }

        console.log(`✅ Inserted ${inserted.length} rows into ${table} from IP: ${clientIP}`)
        return res.json({
          success: true,
          action: 'insert',
          table: table,
          insertedCount: inserted.length,
          data: inserted,
          ip: clientIP
        })

      case 'UPDATE':
        if (!table || !id || !data) {
          return res.status(400).json({ error: 'Table, id, and data required' })
        }

        const { data: updated, error: updateError } = await supabase
          .from(table)
          .update(data)
          .eq('id', id)
          .select()

        if (updateError) {
          console.error(`Update error for table ${table}, id ${id}:`, updateError)
          return res.status(500).json({ 
            error: 'Update failed',
            details: updateError.message,
            table: table,
            id: id
          })
        }

        console.log(`✅ Updated row ${id} in ${table} from IP: ${clientIP}`)
        return res.json({
          success: true,
          action: 'update',
          table: table,
          id: id,
          data: updated,
          ip: clientIP
        })

      case 'DELETE':
        if (!table || !id) {
          return res.status(400).json({ error: 'Table and id required' })
        }

        const { data: deleted, error: deleteError } = await supabase
          .from(table)
          .delete()
          .eq('id', id)
          .select()

        if (deleteError) {
          console.error(`Delete error for table ${table}, id ${id}:`, deleteError)
          return res.status(500).json({ 
            error: 'Delete failed',
            details: deleteError.message,
            table: table,
            id: id
          })
        }

        console.log(`✅ Deleted row ${id} from ${table} from IP: ${clientIP}`)
        return res.json({
          success: true,
          action: 'delete',
          table: table,
          id: id,
          data: deleted,
          ip: clientIP
        })

      case 'RAW_SQL':
        if (!query) {
          return res.status(400).json({ error: 'SQL query required' })
        }

        // For security, we'll use rpc for SQL execution
        const { data: sqlResult, error: sqlError } = await supabase.rpc('exec_sql', {
          query_text: query,
          is_readonly: query.trim().toLowerCase().startsWith('select')
        }).catch(err => ({ error: err }))

        if (sqlError) {
          console.error(`SQL execution error:`, sqlError)
          return res.status(500).json({ 
            error: 'SQL execution failed',
            details: sqlError.message,
            query: query.substring(0, 100) + '...'
          })
        }

        console.log(`✅ SQL executed from IP: ${clientIP}`)
        return res.json({
          success: true,
          action: 'raw_sql',
          result: sqlResult,
          ip: clientIP
        })

      default:
        return res.status(400).json({ 
          error: 'Invalid action',
          validActions: ['GET_ALL_TABLES', 'GET_TABLE', 'INSERT', 'UPDATE', 'DELETE', 'RAW_SQL']
        })
    }

  } catch (error) {
    console.error('❌ Database operation error:', error)
    return res.status(500).json({ 
      error: 'Database operation failed',
      details: error.message,
      ip: clientIP,
      timestamp: new Date().toISOString()
    })
  }
})
