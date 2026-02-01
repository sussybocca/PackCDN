# 📦 PackCDN - Instant Package Publishing Platform

PackCDN is a zero-configuration platform for instantly publishing and sharing code packages. No registration required. Anonymous and free forever.

## 🚀 Quick Links
- **Live Site**: https://pack-cdn.vercel.app
- **CDN**: https://packcdn.firefly-worker.workers.dev
- **Editor**: https://pack-cdn.vercel.app/editor.html
- **Explore**: https://pack-cdn.vercel.app/explore.html

## ✨ Features

### For Users
- **Anonymous Publishing**: No accounts, no tracking
- **Multi-language Support**: JavaScript/TypeScript, Python, WebAssembly
- **Instant Global CDN**: Packages available worldwide in seconds
- **Built-in Editor**: Monaco Editor with syntax highlighting
- **WASM Support**: Upload and validate WebAssembly binaries
- **Public/Private Packages**: Optional encryption for private packages
- **Package Discovery**: Search and browse community packages
- **Package Pages**: Beautiful info pages with install instructions

### For Developers
- **RESTful API**: Simple endpoints for integration
- **Type Support**: npm modules, Python packages, WASM modules
- **Code Analysis**: Automatic dependency detection
- **Search API**: Filter by type, name, and popularity
- **Cloudflare CDN**: Global edge network
- **Supabase Backend**: Reliable PostgreSQL database

## 📁 Project Structure
pack-cdn/
├── public/
│ ├── index.html # Landing page
│ ├── editor.html # Package editor with WASM support
│ └── explore.html # Package discovery interface
├── api/
│ ├── get-pack.js # Retrieve packages by ID/URL
│ ├── publish-pack.js # Publish new packages
│ ├── analyze.js # Code analysis & metadata generation
│ └── search.js # Search public packages
├── worker.js # Cloudflare Worker (CDN server)
├── wrangler.toml # Cloudflare Worker configuration
└── README.md # This documentation

text

## 🔧 Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | Vanilla HTML/CSS/JS + Monaco Editor | Package creation UI |
| **Backend** | Vercel Serverless Functions | API endpoints |
| **Database** | Supabase (PostgreSQL) | Package storage |
| **CDN** | Cloudflare Workers | Global package serving |
| **Editor** | Monaco Editor | Code editing experience |

## 🚀 Getting Started

### As a User

1. **Visit** https://pack-cdn.vercel.app
2. **Click** "Create a Pack"
3. **Write code** in the built-in editor
4. **Upload files** (including WASM binaries)
5. **Configure** package name, type, and visibility
6. **Publish** to get instant CDN URLs
7. **Share** your pack URL or use directly

### Using a Package

```javascript
// In browser (ES modules)
import myPackage from 'https://packcdn.firefly-worker.workers.dev/cdn/{url_id}';

// In Node.js (dynamic import)
const myPackage = await import('https://packcdn.firefly-worker.workers.dev/cdn/{url_id}');

// In HTML (script tag)
<script src="https://packcdn.firefly-worker.workers.dev/cdn/{url_id}/index.js"></script>
📦 Package Types
1. NPM/JavaScript Packages
ES modules support

Automatic dependency analysis

Browser and Node.js compatible

2. Python Modules
.py file support

Import statement analysis

Server-side execution ready

3. WebAssembly Modules
.wasm binary upload

Automatic validation

Direct browser execution

🔌 API Reference
1. GET /api/get-pack
Retrieve package data by ID or URL ID.

Query Parameters:

id (required): Package UUID or short URL ID

Response:

json
{
  "success": true,
  "pack": {
    "id": "uuid",
    "url_id": "short-id",
    "name": "package-name",
    "pack_json": {...},
    "files": {...},
    "cdn_url": "https://...",
    "package_type": "npm",
    "is_public": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
2. POST /api/publish-pack
Publish a new package.

Request Body:

json
{
  "name": "package-name",
  "packJson": "{\"name\":\"package-name\",\"type\":\"module\"}",
  "files": {
    "index.js": "export default function() {...}",
    "utils.wasm": "base64-encoded-wasm"
  },
  "isPublic": true
}
Response:

json
{
  "success": true,
  "packId": "uuid",
  "urlId": "short-id",
  "cdnUrl": "https://packcdn.firefly-worker.workers.dev/cdn/short-id",
  "workerUrl": "https://packcdn.firefly-worker.workers.dev/pack/short-id",
  "installCommand": "pack install package-name https://...",
  "encryptedKey": "optional-key-for-private-packages"
}
3. POST /api/analyze
Analyze code and generate package metadata.

Request Body:

json
{
  "code": "import React from 'react';",
  "packageName": "my-package",
  "packageType": "npm"
}
Response:

json
{
  "success": true,
  "packJson": {
    "name": "my-package",
    "version": "1.0.0",
    "type": "npm",
    "dependencies": {"react": "latest"},
    "entryPoints": ["index.js"]
  },
  "fileStructure": [...]
}
4. GET /api/search
Search and filter public packages.

Query Parameters:

q: Search query (name)

type: Package type (npm/python/wasm)

page: Page number (default: 1)

limit: Results per page (default: 20)

Response:

json
{
  "success": true,
  "packs": [
    {
      "id": "uuid",
      "name": "package-name",
      "version": "1.0.0",
      "package_type": "npm",
      "views": 100,
      "downloads": 50,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "page": 1,
  "total": 100,
  "hasMore": true
}
🌐 Cloudflare Worker Configuration
wrangler.toml
toml
name = "packcdn"
main = "Clouflare_Workers/cdn_worker.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[env.production]
workers_dev = true

[env.development]
workers_dev = true

[dev]
port = 8787
ip = "127.0.0.1"

[vars]
API_BASE_URL = "https://pack-cdn.vercel.app/api"
DEFAULT_ORIGIN = "*"

# CORS configuration
[[cors]]
origins = [
  "https://pack-cdn.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173"
]
methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
headers = [
  "Content-Type",
  "Authorization",
  "Accept",
  "Origin",
  "X-Requested-With",
  "Access-Control-Allow-Origin"
]
max_age = 86400
Worker Routes (packcdn.firefly-worker.workers.dev)
Route	Purpose
/cdn/{url_id}	Serve package files
/cdn/{url_id}/{file}	Serve specific file
/pack/{url_id}	Package info page
/search	Search proxy (to API)
/	Landing page
🗄️ Database Schema (Supabase)
packs Table
Column	Type	Description
id	UUID (primary)	Unique identifier
url_id	TEXT	Short URL ID (e.g., "abc123xyz")
name	TEXT	Package name
pack_json	JSONB/TEXT	Package metadata
files	JSONB	File contents as object
cdn_url	TEXT	CDN base URL
worker_url	TEXT	Package page URL
encrypted_key	TEXT	Encryption key (private packages)
is_public	BOOLEAN	Public/private flag
package_type	TEXT	npm/python/wasm
version	TEXT	Package version
views	INTEGER	View count
downloads	INTEGER	Download count
created_at	TIMESTAMP	Creation timestamp
🛠️ Development Setup
Prerequisites
Node.js 18+

Vercel CLI (npm i -g vercel)

Cloudflare Wrangler CLI (npm i -g wrangler)

Supabase account

Backend Setup
bash
# Clone repository
git clone <repository-url>
cd pack-cdn

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Deploy to Vercel
vercel
Frontend Development
bash
# Local development
npm run dev
# Open http://localhost:3000
Cloudflare Worker Setup
bash
# Login to Cloudflare
wrangler login

# Deploy worker
wrangler deploy

# Local development
wrangler dev
Environment Variables
env
# Vercel/Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key

# Cloudflare
CLOUDFLARE_API_TOKEN=your_cloudflare_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
📝 Package Lifecycle
Publishing Flow
text
User → editor.html → /api/analyze → /api/publish-pack → Supabase
      ↑                                         ↓
explore.html ← /api/search ← Cloudflare Worker ← /api/get-pack
File Storage Format
javascript
// In Supabase 'files' column
{
  "index.js": "export default function() { ... }",
  "utils.py": "def calculate(): ...",
  "module.wasm": "AGFzbQEAAAAG...", // base64 encoded
  "README.md": "# My Package",
  "package.json": "{\"name\":\"my-package\",...}"
}
CDN Serving Flow
text
Client → https://packcdn.firefly-worker.workers.dev/cdn/{url_id}
        ↓
Cloudflare Worker → /api/get-pack?id={url_id}
                    ↓
                  Supabase → Return files
                    ↓
                Worker → Serve file content
🔒 Security & Privacy
Anonymous: No user accounts, no personal data collection

Encryption: Private packages use generated encryption keys

CORS: Properly configured for security

Validation: WASM file validation prevents malicious uploads

Rate Limiting: Built-in protection against abuse

📈 Usage Examples
Create a Utility Package
Visit editor.html

Write JavaScript functions in index.js

Add package.json metadata

Publish → Get CDN URL

Use in projects: import utils from 'https://...'

Share a WebAssembly Module
Compile Rust/C/C++ to .wasm

Upload in editor

Write JavaScript wrapper

Publish → Get WASM CDN URL

Use in browser with WebAssembly.instantiate()

Create Python Library
Write Python code in .py files

Add import statements

Publish → Get CDN URL

Download and use in Python projects

🤝 Contributing
Fork the repository

Create a feature branch

Make changes with tests

Submit a pull request

📄 License
MIT License - see LICENSE file

🙏 Acknowledgments
Monaco Editor by Microsoft

Cloudflare Workers

Vercel Serverless Functions

Supabase PostgreSQL

All contributors and users

🐛 Troubleshooting
Common Issues
WASM upload fails

Ensure valid .wasm binary

Check file size limits

Verify browser support

Package not found

Check URL ID is correct

Verify package is public

Ensure API is accessible

CORS errors

Check origin is in allowed list

Verify Cloudflare Worker CORS config

Ensure proper headers

Publish fails

Check package name uniqueness

Verify file size limits

Ensure valid JSON in pack_json

Support
Create issue on GitHub

Check API status at /api/health

Verify worker status at Cloudflare dashboard

PackCDN - Making package publishing instant, anonymous, and accessible to everyone.
