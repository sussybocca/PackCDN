import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ 
      fontFamily: 'Arial, sans-serif',
      maxWidth: '800px',
      margin: '0 auto',
      padding: '2rem'
    }}>
      <h1>🚀 Next.js + TypeScript on Netlify</h1>
      <p>This is the MAIN PAGE using Next.js App Router</p>
      <p>File: <code>/app/page.tsx</code></p>
      
      <div style={{
        background: '#f5f5f5',
        padding: '1rem',
        borderRadius: '8px',
        marginTop: '1rem'
      }}>
        <h3>📁 Navigation:</h3>
        <ul>
          <li><Link href="/files.html">View auto-generated file listing →</Link></li>
          <li><Link href="/about">About page (another TSX page)</Link></li>
        </ul>
      </div>
    </main>
  )
}
