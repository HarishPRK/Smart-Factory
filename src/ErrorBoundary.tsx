import React from "react";

interface State {
  error: Error | null;
  info: React.ErrorInfo | null;
}

/**
 * Root error boundary Ã¢â‚¬â€ renders a readable debug panel instead of a white screen.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ error, info });
    console.error("[ErrorBoundary] caught error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            padding: 24,
            background: "#0b1117",
            color: "#e4ebf3",
            fontFamily: "'Montserrat', system-ui, sans-serif",
            overflow: "auto",
            zIndex: 999999,
          }}
        >
          <div
            style={{
              maxWidth: 900,
              margin: "40px auto",
              padding: 24,
              background: "#141b27",
              border: "1px solid #2a3444",
              borderRadius: 10,
              boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#EE1C25",
                fontWeight: 700,
              }}
            >
              Ã¢â€”Â Runtime Error
            </div>
            <h2
              style={{
                fontSize: 20,
                margin: "8px 0 16px",
                color: "#e4ebf3",
                fontWeight: 700,
              }}
            >
              {this.state.error.name}: {this.state.error.message}
            </h2>
            <pre
              style={{
                background: "#0f1520",
                border: "1px solid #2a3444",
                padding: 12,
                fontSize: 12,
                color: "#cfd9e6",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                borderRadius: 6,
                overflow: "auto",
              }}
            >
              {this.state.error.stack}
            </pre>
            {this.state.info && (
              <>
                <div
                  style={{
                    marginTop: 16,
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: "#8a97a8",
                    fontWeight: 700,
                  }}
                >
                  Component Stack
                </div>
                <pre
                  style={{
                    background: "#0f1520",
                    border: "1px solid #2a3444",
                    padding: 12,
                    fontSize: 12,
                    color: "#cfd9e6",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    borderRadius: 6,
                    marginTop: 6,
                    overflow: "auto",
                  }}
                >
                  {this.state.info.componentStack}
                </pre>
              </>
            )}
            <button
              onClick={() => location.reload()}
              style={{
                marginTop: 16,
                padding: "8px 16px",
                background: "#75b0ea",
                border: "none",
                borderRadius: 4,
                color: "#0b1117",
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontSize: 11,
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
