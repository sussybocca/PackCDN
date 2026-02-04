export default async function handler(req, res) {
  const correctPassword = process.env.PASSWORD;
  
  // Check if password is provided via query parameter
  const providedPassword = req.query.password;
  
  // Check if password is already authenticated via cookie
  const isAuthenticated = req.cookies.admin_auth === 'true';

  // If authenticated via cookie, serve the admin page
  if (isAuthenticated) {
    // Read and serve the admin.html file
    const fs = require('fs');
    const path = require('path');
    
    try {
      const adminHtmlPath = path.join(process.cwd(), 'Private', 'admin.html');
      const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');
      
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(adminHtml);
    } catch (error) {
      return res.status(404).send('Admin page not found');
    }
  }

  // Check if password is being submitted
  if (providedPassword) {
    if (providedPassword === correctPassword) {
      // Set authentication cookie (expires in 1 hour)
      res.setHeader('Set-Cookie', 'admin_auth=true; Path=/; HttpOnly; Max-Age=3600');
      
      // Redirect to admin page
      res.writeHead(302, { 'Location': req.url.split('?')[0] });
      return res.end();
    } else {
      // Show error message
      return showPasswordForm(res, 'Incorrect password. Please try again.');
    }
  }

  // Show password form
  return showPasswordForm(res);
}

function showPasswordForm(res, errorMessage = '') {
  res.setHeader('Content-Type', 'text/html');
  res.status(401).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Admin Access Required</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
        }
        
        .login-container {
          background: rgba(255, 255, 255, 0.95);
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          width: 90%;
          max-width: 400px;
          text-align: center;
          backdrop-filter: blur(10px);
        }
        
        .logo {
          font-size: 2.5em;
          margin-bottom: 20px;
          color: #333;
        }
        
        h1 {
          color: #333;
          margin-bottom: 30px;
          font-weight: 300;
        }
        
        .password-input {
          width: 100%;
          padding: 15px;
          border: 2px solid #ddd;
          border-radius: 10px;
          font-size: 16px;
          margin-bottom: 20px;
          box-sizing: border-box;
          transition: border-color 0.3s;
        }
        
        .password-input:focus {
          outline: none;
          border-color: #667eea;
        }
        
        .submit-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 15px 30px;
          border-radius: 10px;
          font-size: 16px;
          cursor: pointer;
          width: 100%;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .submit-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
        }
        
        .error-message {
          color: #e74c3c;
          background: rgba(231, 76, 60, 0.1);
          padding: 10px;
          border-radius: 5px;
          margin-bottom: 20px;
        }
        
        .hint {
          margin-top: 20px;
          color: #666;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="login-container">
        <div class="logo">🔐</div>
        <h1>Admin Access Required</h1>
        
        ${errorMessage ? `<div class="error-message">${errorMessage}</div>` : ''}
        
        <form method="GET" action="">
          <input 
            type="password" 
            name="password" 
            class="password-input" 
            placeholder="Enter admin password" 
            required
            autocomplete="current-password"
            autofocus
          >
          <button type="submit" class="submit-btn">Access Admin Panel</button>
        </form>
        
        <div class="hint">
          Contact system administrator for credentials
        </div>
      </div>
    </body>
    </html>
  `);
}
