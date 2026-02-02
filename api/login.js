import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { serialize } from 'cookie';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Email transporter with YOUR exact variable names
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Generate anonymous username
function generateUsername() {
  const adjectives = ['Quantum', 'Stealth', 'Phantom', 'Cipher', 'Nova', 'Zenith', 'Vortex', 'Nexus'];
  const animals = ['Wolf', 'Fox', 'Raven', 'Lynx', 'Hawk', 'Owl', 'Panther', 'Falcon'];
  const number = crypto.randomInt(1000, 9999);
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${adj}${animal}${number}`;
}

// Generate 20 recovery codes
function generateRecoveryCodes() {
  const codes = [];
  for (let i = 0; i < 20; i++) {
    codes.push(crypto.randomBytes(6).toString('hex').toUpperCase());
  }
  return codes;
}

// Send email with recovery codes
async function sendRecoveryEmail(email, username, recoveryCodes) {
  const codeList = recoveryCodes.map((code, i) => `${i + 1}. ${code}`).join('\n');
  
  const mailOptions = {
    from: `"PackCDN Security" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your PackCDN Recovery Codes',
    text: `
Welcome to PackCDN!

Your anonymous username: ${username}
Keep this username secret!

RECOVERY CODES (Use one per login):
${codeList}

IMPORTANT:
- Each code can only be used once
- Codes are used in order (1-20)
- Save these codes in a secure place
- Login at: https://packcdn.vercel.app/login

Never share these codes with anyone!
    `,
    html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #2563eb;">Welcome to PackCDN!</h2>
  
  <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Your anonymous username:</strong>
    <code style="background: #1f2937; color: #fff; padding: 5px 10px; border-radius: 3px; display: inline-block; margin: 5px 0;">
      ${username}
    </code>
    <p><em>Keep this username secret!</em></p>
  </div>

  <h3 style="color: #dc2626;">RECOVERY CODES</h3>
  <div style="background: #fee2e2; padding: 15px; border-radius: 5px; font-family: monospace; line-height: 1.8;">
    ${recoveryCodes.map((code, i) => 
      `<div>${i + 1}. <strong>${code}</strong></div>`
    ).join('')}
  </div>

  <div style="margin-top: 30px; padding: 15px; background: #dbeafe; border-radius: 5px;">
    <h4 style="color: #1d4ed8;">📋 IMPORTANT:</h4>
    <ul>
      <li>Each code can only be used <strong>ONCE</strong></li>
      <li>Codes are used in order (1-20)</li>
      <li>Save these codes in a secure place</li>
      <li>Login at: <a href="https://packcdn.vercel.app/login">https://packcdn.vercel.app/login</a></li>
    </ul>
    <p style="color: #dc2626; font-weight: bold;">⚠️ Never share these codes with anyone!</p>
  </div>
</div>
    `
  };

  return transporter.sendMail(mailOptions);
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { action, email, code, rememberMe } = req.body;

    try {
      if (action === 'initiate') {
        // Step 1: Generate username and send email
        const username = generateUsername();
        const recoveryCodes = generateRecoveryCodes();
        
        // Check if email already exists
        const { data: existingUser } = await supabase
          .from('Pack_Users')
          .select('email')
          .eq('email', email)
          .single();

        if (existingUser) {
          return res.status(400).json({ 
            error: 'Email already registered. Use your recovery codes to login.' 
          });
        }

        // Create user in database
        const { error: insertError } = await supabase
          .from('Pack_Users')
          .insert({
            anonymous_username: username,
            email: email,
            recovery_codes: recoveryCodes,
            current_code_index: 0,
            created_at: new Date().toISOString()
          });

        if (insertError) throw insertError;

        // Send email
        await sendRecoveryEmail(email, username, recoveryCodes);

        return res.status(200).json({ 
          success: true, 
          message: 'Recovery codes sent to your email',
          username: username 
        });

      } else if (action === 'verify') {
        // Step 2: Verify recovery code
        const { data: user } = await supabase
          .from('Pack_Users')
          .select('*')
          .eq('email', email)
          .single();

        if (!user) {
          return res.status(400).json({ error: 'User not found' });
        }

        const currentCode = user.recovery_codes[user.current_code_index];
        
        if (currentCode === code) {
          // Code is correct
          const token = jwt.sign(
            { 
              userId: user.id, 
              username: user.anonymous_username,
              email: user.email 
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
          );

          // Update code index
          const newIndex = user.current_code_index + 1;
          const { error: updateError } = await supabase
            .from('Pack_Users')
            .update({ 
              current_code_index: newIndex,
              last_login: new Date().toISOString()
            })
            .eq('id', user.id);

          if (updateError) throw updateError;

          // Set cookie
          const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
            maxAge: rememberMe ? 30 * 24 * 60 * 60 : 60 * 60 // 30 days or 1 hour
          };

          if (rememberMe) {
            // Generate remember me token
            const rememberToken = crypto.randomBytes(32).toString('hex');
            const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            
            await supabase
              .from('Pack_Users')
              .update({
                remember_me_token: rememberToken,
                remember_me_expires: expires.toISOString()
              })
              .eq('id', user.id);

            cookieOptions.maxAge = 30 * 24 * 60 * 60;
          }

          res.setHeader('Set-Cookie', serialize('packcdn_auth', token, cookieOptions));

          return res.status(200).json({ 
            success: true, 
            message: 'Login successful',
            username: user.anonymous_username,
            codesRemaining: 20 - newIndex
          });

        } else {
          return res.status(400).json({ error: 'Invalid recovery code' });
        }
      }

    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
