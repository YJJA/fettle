import React from "react";
import type { PropsWithChildren, ReactNode } from "react";

export type ErrorBoundaryProps = PropsWithChildren<{
  fallback?(error: Error): ReactNode;
}>;

export default class ErrorBoundary extends React.PureComponent<ErrorBoundaryProps> {
  state: { hasError: boolean; error?: Error } = { hasError: false };

  static getDerivedStateFromError(error: Error): {
    hasError: boolean;
    error?: Error;
  } {
    return { hasError: true, error };
  }

  // componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
  //   this.setState({ error, hasError: true });
  // }

  render() {
    return this.state.hasError ? (
      this.props.fallback && this.state.error ? (
        this.props.fallback(this.state.error)
      ) : (
        <div data-testid="error-fallback">error</div>
      )
    ) : (
      this.props.children
    );
  }
}
