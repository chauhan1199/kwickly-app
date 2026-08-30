import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught an error:', error, info)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', gap: 16, padding: 32, textAlign: 'center',
        background: 'var(--bg, #0d1117)', color: 'var(--text, #e6edf3)', fontFamily: 'inherit',
      }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Something went wrong</h1>
        <p style={{ margin: 0, maxWidth: 480, fontSize: 14, color: 'var(--mid, #8b949e)', wordBreak: 'break-word' }}>
          {this.state.error.message || 'An unexpected error occurred while rendering this page.'}
        </p>
        <button
          onClick={this.handleReload}
          style={{
            marginTop: 8, padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'var(--primary, #00B4D8)', color: '#fff', fontWeight: 700, fontSize: 14,
          }}
        >
          Reload
        </button>
      </div>
    )
  }
}
