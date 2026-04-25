import { Button, Result } from "antd";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Render a custom fallback. Receives the error and a reset function. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level React error boundary. Wrap `<App />` in `main.tsx` to
 * prevent a render error from blanking the whole UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Hook for telemetry; replace with Sentry/Datadog when added.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <Result
        status="500"
        title="Something went wrong"
        subTitle={error.message || "An unexpected error occurred."}
        extra={[
          <Button key="reload" type="primary" onClick={() => window.location.reload()}>
            Reload page
          </Button>,
          <Button key="reset" onClick={this.reset}>
            Try again
          </Button>,
        ]}
      />
    );
  }
}

export default ErrorBoundary;
