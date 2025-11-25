/**
 * Error Boundary Component
 *
 * Class-based error boundary following Context7 patterns for scoped error handling.
 * Provides reset/retry controls and descriptive error messages.
 */

import { Component } from 'react';
import type { ReactNode } from 'react';

export interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Descriptive name for this boundary (e.g., "PDF Renderer", "Konva Layer") */
  name?: string;
  /** Optional fallback UI to render instead of default */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Optional callback when error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary - Scoped error boundary with reset capability
 *
 * Features:
 * - Catches rendering errors in child components
 * - Provides descriptive error messages with boundary name
 * - Reset/retry button to attempt recovery
 * - Logs errors for debugging
 * - Custom fallback UI support
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console (could be extended to send to error reporting service)
    console.error(`Error caught by ${this.props.name ?? 'ErrorBoundary'}:`, error, errorInfo);

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      // Default fallback UI
      const boundaryName = this.props.name ?? 'Component';

      return (
        <div className="flex items-center justify-center p-6">
          <div className="glass-card p-6 bg-red-50 border-red-200 max-w-md">
            <div className="flex items-start space-x-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900">{boundaryName} Error</h3>
                <p className="text-sm text-red-700 mt-1">
                  {this.state.error.message || 'An unexpected error occurred'}
                </p>
                {process.env['NODE_ENV'] === 'development' && (
                  <details className="mt-2">
                    <summary className="text-xs text-red-600 cursor-pointer hover:underline">
                      Error details
                    </summary>
                    <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto max-h-40">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            </div>
            <button
              onClick={this.handleReset}
              className="mt-4 w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
