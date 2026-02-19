import React from 'react'
import ReactDOM from 'react-dom/client'

function App() {
  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif',
      maxWidth: '800px',
      margin: '0 auto',
      padding: '2rem'
    }}>
      <h1>Hello from NETLIFY/ page.tsx!</h1>
      <p>This is a React component written in TypeScript (TSX)</p>
      
      <div style={{
        background: '#f5f5f5',
        padding: '1rem',
        borderRadius: '8px',
        marginTop: '1rem'
      }}>
        <h3>📁 Static Files:</h3>
        <p>
          <a href="/files.html">View auto-generated file listing →</a>
        </p>
      </div>
    </div>
  )
}

// Get the root element safely (remove the ! non-null assertion)
const rootElement = document.getElementById('root')
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} else {
  console.error('Root element not found')
}
