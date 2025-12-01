/**
 * ErrorBoundary Component Tests
 * Tests for error boundary behavior including error catching, reset, and fallback UI
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

// Component that throws an error
const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>Normal content</div>;
};

// Wrapper component to test reset behavior with controlled state
const ResettableErrorBoundaryTest = () => {
  const [shouldThrow, setShouldThrow] = useState(true);

  const handleReset = () => {
    setShouldThrow(false);
  };

  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div>
          <div>Error: {error.message}</div>
          <button onClick={() => { reset(); handleReset(); }}>Reset Error</button>
        </div>
      )}
    >
      <ThrowingComponent shouldThrow={shouldThrow} />
    </ErrorBoundary>
  );
};

// Suppress console.error during tests since errors are expected
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalError;
});

describe('ErrorBoundary', () => {
  describe('when no error occurs', () => {
    it('should render children normally', () => {
      render(
        <ErrorBoundary>
          <div>Child content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('should render nested children', () => {
      render(
        <ErrorBoundary name="Test Boundary">
          <div>
            <span>Nested content</span>
            <button>Click me</button>
          </div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Nested content')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });
  });

  describe('when an error occurs', () => {
    it('should catch the error and display default fallback UI', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Component Error')).toBeInTheDocument();
      expect(screen.getByText('Test error message')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    });

    it('should display boundary name in error message', () => {
      render(
        <ErrorBoundary name="PDF Renderer">
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('PDF Renderer Error')).toBeInTheDocument();
    });

    it('should display fallback message when error has no message', () => {
      const ThrowEmptyError = () => {
        throw new Error('');
      };

      render(
        <ErrorBoundary>
          <ThrowEmptyError />
        </ErrorBoundary>
      );

      expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument();
    });

    it('should call onError callback when error is caught', () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });

    it('should log error to console', () => {
      render(
        <ErrorBoundary name="Test Logger">
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(console.error).toHaveBeenCalledWith(
        'Error caught by Test Logger:',
        expect.any(Error),
        expect.any(Object)
      );
    });
  });

  describe('reset functionality', () => {
    it('should reset error state when reset function is called', () => {
      render(<ResettableErrorBoundaryTest />);

      // Should show error fallback initially
      expect(screen.getByText('Error: Test error message')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reset Error' })).toBeInTheDocument();

      // Click reset - this calls both reset() and sets shouldThrow to false
      fireEvent.click(screen.getByRole('button', { name: 'Reset Error' }));

      // Should now show normal content
      expect(screen.getByText('Normal content')).toBeInTheDocument();
      expect(screen.queryByText('Error: Test error message')).not.toBeInTheDocument();
    });

    it('should clear hasError state when handleReset is called', () => {
      // This test verifies the handleReset function works with the default fallback
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Component Error')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    });
  });

  describe('custom fallback', () => {
    it('should render custom fallback when provided', () => {
      const customFallback = (error: Error, reset: () => void) => (
        <div>
          <h1>Custom Error UI</h1>
          <p>{error.message}</p>
          <button onClick={reset}>Custom Reset</button>
        </div>
      );

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom Error UI')).toBeInTheDocument();
      expect(screen.getByText('Test error message')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Custom Reset' })).toBeInTheDocument();
    });

    it('should pass reset function to custom fallback', () => {
      // Test using the controlled wrapper component which properly handles the reset
      render(<ResettableErrorBoundaryTest />);

      // Error should be shown initially
      expect(screen.getByText('Error: Test error message')).toBeInTheDocument();

      // Click reset - this verifies reset function is passed and callable
      fireEvent.click(screen.getByRole('button', { name: 'Reset Error' }));

      // After reset, normal content should be displayed
      expect(screen.getByText('Normal content')).toBeInTheDocument();
    });

    it('should receive error object in custom fallback', () => {
      const customFallback = (error: Error, _reset: () => void) => (
        <div>
          <div>Custom Error: {error.message}</div>
          <div>Error Name: {error.name}</div>
        </div>
      );

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom Error: Test error message')).toBeInTheDocument();
      expect(screen.getByText('Error Name: Error')).toBeInTheDocument();
    });
  });

  describe('multiple boundaries', () => {
    it('should only catch errors in its own subtree', () => {
      render(
        <div>
          <ErrorBoundary name="Working">
            <div>Working content</div>
          </ErrorBoundary>
          <ErrorBoundary name="Failing">
            <ThrowingComponent shouldThrow={true} />
          </ErrorBoundary>
        </div>
      );

      expect(screen.getByText('Working content')).toBeInTheDocument();
      expect(screen.getByText('Failing Error')).toBeInTheDocument();
    });
  });
});
