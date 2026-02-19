// NO IMPORTS NEEDED - React and ReactDOM are global from the script tags

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

// Get the root element safely
const rootElement = document.getElementById('root')
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    React.createElement(React.StrictMode, null,
      React.createElement(App, null)
    )
  )
} else {
  console.error('Root element not found')
}
