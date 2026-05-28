import { Component } from 'react';

/**
 * H14: Catch render errors anywhere in the tree so the user sees a
 * recovery card instead of a blank white screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        className="pc-app"
        style={{
          height: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--pc-bg)',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            padding: 32,
            background: 'var(--pc-surface)',
            border: '1px solid var(--pc-danger-border)',
            borderRadius: 14,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, color: 'var(--pc-text)' }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: 'var(--pc-text-3)', marginBottom: 20, lineHeight: 1.55 }}>
            {this.state.error.message || 'An unexpected error occurred.'}
          </div>
          <button
            className="pc-btn pc-btn-primary"
            style={{ justifyContent: 'center' }}
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
