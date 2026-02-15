// middleware.js
import { NextResponse } from 'next/server';

// ----------------------------------------------------------------------
// Environment and helpers
// ----------------------------------------------------------------------
const REAL_PASSWORD = process.env.PASSWORD;               // the one correct password
if (!REAL_PASSWORD) throw new Error('PASSWORD env var not set');

// Generate a random hex string of given length (default 8)
function randomHex(length = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// Generate 100 passwords: 99 random + the real one at a random index
function generatePasswordList() {
  const randoms = Array.from({ length: 99 }, () => randomHex(8));
  const correctIndex = Math.floor(Math.random() * 100);
  randoms.splice(correctIndex, 0, REAL_PASSWORD);
  return randoms;
}

// Compute SHA‑256 hash of a string (hex output)
async function sha256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ----------------------------------------------------------------------
// HTML templates for each stage
// ----------------------------------------------------------------------

// Stage 1: A simple math puzzle
function renderStage1(error = null) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>🔐 Stage 1: Puzzle</title>
  <style>${commonStyles}</style>
</head>
<body>
  <div class="container">
    <h1>🔐 STAGE 1: PUZZLE</h1>
    <div class="description">
      Solve this puzzle to proceed to the next stage.
    </div>
    ${error ? `<div class="error">❌ ${error}</div>` : ''}
    <form method="POST" action="/Private/admin.html">
      <input type="hidden" name="action" value="stage1">
      <div class="puzzle">
        What is 7 * 13 - 5 ?
      </div>
      <input type="number" name="answer" class="input-field" placeholder="Your answer" required>
      <button type="submit" class="btn">Submit</button>
    </form>
    <div class="footer">
      QUANTUM FIREWALL CHALLENGE • STAGE 1/2
    </div>
  </div>
</body>
</html>`;
}

// Stage 2: Hash challenge with 100 passwords
async function renderStage2(puzzleAnswer, error = null) {
  const passwords = generatePasswordList();
  const targetHash = await sha256(REAL_PASSWORD + puzzleAnswer);

  // Build password grid
  const listItems = passwords.map(pw => 
    `<li><button type="submit" name="password" value="${pw}" class="password-btn">${pw}</button></li>`
  ).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>🔐 Stage 2: Cryptographic Hunt</title>
  <style>${commonStyles}</style>
  <script>
    // Provide a helper to compute SHA‑256 on the client (for users who want to automate)
    async function computeHash() {
      const selected = document.getElementById('manualPassword').value;
      const answer = "${puzzleAnswer}";
      if (!selected) return alert('Enter a password');
      const encoder = new TextEncoder();
      const data = encoder.encode(selected + answer);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      document.getElementById('manualResult').innerText = 'Hash: ' + hashHex;
    }
  </script>
</head>
<body>
  <div class="container">
    <h1>🔐 STAGE 2: CRYPTOGRAPHIC HUNT</h1>
    <div class="description">
      Below are 100 passwords. Only one, when concatenated with the answer from Stage 1<br>
      (<strong>${puzzleAnswer}</strong>), produces the following SHA‑256 hash:
    </div>
    <div class="target-hash">${targetHash}</div>
    ${error ? `<div class="error">❌ ${error}</div>` : ''}
    <form method="POST" action="/Private/admin.html">
      <input type="hidden" name="action" value="stage2">
      <ul class="password-grid">
        ${listItems}
      </ul>
      <div class="reset-link">
        <a href="/Private/admin.html?reset=1">🔄 New set of passwords</a>
      </div>
    </form>

    <div class="manual-tool">
      <h3>🔧 Manual hash tool</h3>
      <input type="text" id="manualPassword" placeholder="Enter a password to test" class="input-field">
      <button onclick="computeHash()" class="btn">Compute hash</button>
      <div id="manualResult" class="hash-result"></div>
    </div>

    <div class="footer">
      QUANTUM FIREWALL CHALLENGE • STAGE 2/2
    </div>
  </div>
</body>
</html>`;
}

// Common CSS for both stages
const commonStyles = `
  body {
    background: #0a0a0a;
    color: #00ff41;
    font-family: 'Courier New', monospace;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    margin: 0;
    padding: 20px;
  }
  .container {
    max-width: 1000px;
    width: 100%;
    background: #111;
    border: 2px solid #ff0033;
    border-radius: 8px;
    padding: 30px;
    box-shadow: 0 0 30px rgba(255,0,51,0.3);
  }
  h1 {
    text-align: center;
    color: #ff0033;
    text-shadow: 0 0 10px #ff0033;
    margin-top: 0;
  }
  .description {
    text-align: center;
    margin-bottom: 20px;
    color: #888;
  }
  .error {
    color: #ff3333;
    text-align: center;
    padding: 10px;
    border: 1px solid #ff3333;
    margin-bottom: 20px;
  }
  .target-hash {
    background: #1a1a1a;
    padding: 15px;
    border: 1px solid #0066ff;
    border-radius: 4px;
    text-align: center;
    font-family: monospace;
    font-size: 14px;
    word-break: break-all;
    margin-bottom: 20px;
    color: #ffcc00;
  }
  .password-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px;
    width: 100%;
    margin-bottom: 20px;
    list-style: none;
    padding: 0;
  }
  .password-btn {
    width: 100%;
    padding: 10px;
    background: #1a1a1a;
    border: 1px solid #0066ff;
    border-radius: 4px;
    color: #00ff41;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .password-btn:hover {
    background: #0066ff;
    color: white;
    border-color: #00ff41;
    box-shadow: 0 0 10px #0066ff;
  }
  .reset-link {
    text-align: center;
    margin: 20px 0;
  }
  .reset-link a {
    color: #ff6600;
    text-decoration: none;
    border: 1px solid #ff6600;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
  }
  .reset-link a:hover {
    background: #ff6600;
    color: black;
  }
  .manual-tool {
    margin-top: 30px;
    padding: 20px;
    background: #1a1a1a;
    border: 1px solid #00ff41;
    border-radius: 4px;
  }
  .manual-tool h3 {
    color: #00ff41;
    margin-top: 0;
  }
  .input-field {
    width: 100%;
    padding: 10px;
    background: #0a0a0a;
    border: 1px solid #0066ff;
    border-radius: 4px;
    color: #00ff41;
    font-family: 'Courier New', monospace;
    margin-bottom: 10px;
  }
  .btn {
    padding: 10px 20px;
    background: #0066ff;
    border: none;
    border-radius: 4px;
    color: white;
    font-weight: bold;
    cursor: pointer;
    font-family: 'Courier New', monospace;
  }
  .btn:hover {
    background: #00ff41;
    color: black;
  }
  .hash-result {
    margin-top: 10px;
    padding: 10px;
    background: #0a0a0a;
    border: 1px solid #ff6600;
    border-radius: 4px;
    word-break: break-all;
    font-size: 12px;
  }
  .footer {
    margin-top: 30px;
    text-align: center;
    font-size: 12px;
    color: #444;
  }
  .puzzle {
    font-size: 24px;
    text-align: center;
    margin: 20px 0;
    color: #ffcc00;
  }
`;

// ----------------------------------------------------------------------
// Middleware logic
// ----------------------------------------------------------------------
export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Only protect /Private/admin.html (and optionally /Private/)
  if (pathname !== '/Private/admin.html' && pathname !== '/Private/') {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();

  // Check for final access cookie
  const hasAccess = request.cookies.get('admin_access')?.value === 'true';
  if (hasAccess) {
    // Allow request to proceed to the actual admin page
    return NextResponse.next();
  }

  // Helper to clear all progress cookies (used on reset)
  const clearProgress = (response) => {
    response.cookies.delete('stage1_complete');
    response.cookies.delete('puzzle_answer');
    return response;
  };

  // Handle explicit reset
  if (url.searchParams.get('reset') === '1') {
    const response = NextResponse.redirect(new URL('/Private/admin.html', request.url));
    clearProgress(response);
    return response;
  }

  // Read progress cookies
  const stage1Complete = request.cookies.get('stage1_complete')?.value === 'true';
  const puzzleAnswer = request.cookies.get('puzzle_answer')?.value;

  // ----- POST handling -----
  if (request.method === 'POST') {
    const formData = await request.formData();
    const action = formData.get('action');

    // Stage 1 submission
    if (action === 'stage1') {
      const answer = formData.get('answer');
      // Simple puzzle: 7*13-5 = 86
      if (answer === '86') {
        const response = NextResponse.redirect(new URL('/Private/admin.html', request.url));
        response.cookies.set('stage1_complete', 'true', { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
        response.cookies.set('puzzle_answer', '86', { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
        return response;
      } else {
        // Wrong answer: show stage1 again with error
        return new NextResponse(renderStage1('Wrong answer. Try again.'), {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        });
      }
    }

    // Stage 2 submission
    if (action === 'stage2') {
      // Must have completed stage1
      if (!stage1Complete || !puzzleAnswer) {
        // Invalid state – start over
        const response = NextResponse.redirect(new URL('/Private/admin.html', request.url));
        clearProgress(response);
        return response;
      }

      const selectedPassword = formData.get('password');
      if (!selectedPassword) {
        // No password selected – show stage2 with error
        return new NextResponse(await renderStage2(puzzleAnswer, 'No password selected.'), {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        });
      }

      // Compute expected hash and compare
      const expectedHash = await sha256(REAL_PASSWORD + puzzleAnswer);
      const candidateHash = await sha256(selectedPassword + puzzleAnswer);

      if (candidateHash === expectedHash) {
        // Correct! Grant access
        const response = NextResponse.redirect(new URL('/Private/admin.html', request.url));
        response.cookies.set('admin_access', 'true', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24, // 1 day
          path: '/'
        });
        // Clear stage cookies (optional)
        clearProgress(response);
        return response;
      } else {
        // Wrong password – show stage2 again with error
        return new NextResponse(await renderStage2(puzzleAnswer, 'Wrong password. Try again.'), {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        });
      }
    }

    // Unknown action – reset
    const response = NextResponse.redirect(new URL('/Private/admin.html', request.url));
    clearProgress(response);
    return response;
  }

  // ----- GET request -----
  if (!stage1Complete) {
    // Stage 1 not completed
    return new NextResponse(renderStage1(), {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  } else {
    // Stage 1 completed, serve stage2
    return new NextResponse(await renderStage2(puzzleAnswer), {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

export const config = {
  matcher: '/Private/:path*',
};
