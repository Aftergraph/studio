'use client';

import React, { type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, info);
    const { onError } = this.props;
    if (onError) {
      onError(error, info);
    }
  }

  reset(): void {
    this.setState({ hasError: false, error: null });
  }

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;
    
    if (hasError) {
      if (fallback) {
        return fallback;
      }
      return (
        <div className="error-boundary" role="alert" aria-live="assertive">
          <h2>Something went wrong</h2>
          <p>{error?.message || 'An unexpected error occurred'}</p>
          <button onClick={() => this.reset()} type="button">
            Try again
          </button>
        </div>
      );
    }
    return children;
  }
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, info: ErrorInfo) => void
): React.ComponentType<P> {
  const WrappedComponent: React.FC<P> = (props: P) => {
    const handleError = onError ? (error: Error, info: ErrorInfo) => onError(error, info) : undefined;
    return (
      <ErrorBoundary fallback={fallback} onError={handleError ?? (() => {})}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;
  return WrappedComponent;
}
