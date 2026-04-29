import { Component } from 'react';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FinFit - 全局错误边界 (ErrorBoundary)
 *
 * 捕获渲染期的未处理异常，展示友好的错误恢复界面，
 * 防止整个页面白屏崩溃。
 * ═══════════════════════════════════════════════════════════════════════════
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] 渲染异常被捕获:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0a0a',
            padding: '24px',
          }}
        >
          <div
            style={{
              maxWidth: '400px',
              width: '100%',
              background: 'rgba(23,23,23,0.95)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '2rem',
              padding: '48px 32px',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* 背景光效 */}
            <div
              style={{
                position: 'absolute',
                top: '-60px',
                right: '-60px',
                width: '120px',
                height: '120px',
                background: 'rgba(239,68,68,0.15)',
                borderRadius: '50%',
                filter: 'blur(40px)',
              }}
            />

            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🐟💥</div>
            <h2
              style={{
                color: '#ffffff',
                fontSize: '22px',
                fontWeight: 900,
                margin: '0 0 8px',
                letterSpacing: '-0.5px',
              }}
            >
              系统开小差了
            </h2>
            <p
              style={{
                color: '#737373',
                fontSize: '14px',
                lineHeight: 1.6,
                margin: '0 0 32px',
              }}
            >
              遇到了一个意外错误，但别担心，你的训练数据都安全保存着。
            </p>

            {/* 错误详情（开发环境可见） */}
            {this.state.error && (
              <div
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '12px',
                  padding: '12px',
                  marginBottom: '24px',
                  textAlign: 'left',
                }}
              >
                <p
                  style={{
                    color: '#f87171',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    margin: 0,
                    wordBreak: 'break-all',
                  }}
                >
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={this.handleReload}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: '#10b981',
                  color: '#000',
                  border: 'none',
                  borderRadius: '16px',
                  fontSize: '14px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 0 20px rgba(16,185,129,0.3)',
                }}
              >
                刷新页面
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: 'rgba(255,255,255,0.05)',
                  color: '#a3a3a3',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                尝试恢复
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
