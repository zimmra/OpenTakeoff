/**
 * Canvas Container Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CanvasContainer } from '../components/CanvasContainer';
import { ViewportProvider } from '../contexts/ViewportContext';

// Mock the useCanvasGestures hook
vi.mock('../hooks/useCanvasGestures', () => ({
  useCanvasGestures: vi.fn(() => ({
    isPanning: false,
    isSpacePressed: false,
  })),
}));

describe('CanvasContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children', () => {
    render(
      <ViewportProvider>
        <CanvasContainer>
          <div data-testid="child">Test Child</div>
        </CanvasContainer>
      </ViewportProvider>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('should apply default container styles', () => {
    render(
      <ViewportProvider>
        <CanvasContainer>{null}</CanvasContainer>
      </ViewportProvider>
    );

    const container = screen.getByTestId('canvas-container');
    expect(container).toHaveStyle({
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      touchAction: 'none',
    });
  });

  it('should apply custom className', () => {
    render(
      <ViewportProvider>
        <CanvasContainer className="custom-class">{null}</CanvasContainer>
      </ViewportProvider>
    );

    const container = screen.getByTestId('canvas-container');
    expect(container).toHaveClass('canvas-container', 'custom-class');
  });

  it('should apply custom styles', () => {
    render(
      <ViewportProvider>
        <CanvasContainer style={{ backgroundColor: 'red' }}>{null}</CanvasContainer>
      </ViewportProvider>
    );

    const container = screen.getByTestId('canvas-container');
    expect(container).toHaveStyle({ backgroundColor: 'red' });
  });

  it('should apply custom data-testid', () => {
    render(
      <ViewportProvider>
        <CanvasContainer data-testid="custom-testid">{null}</CanvasContainer>
      </ViewportProvider>
    );

    expect(screen.getByTestId('custom-testid')).toBeInTheDocument();
  });

  it('should render content wrapper with transform', () => {
    render(
      <ViewportProvider>
        <CanvasContainer>{null}</CanvasContainer>
      </ViewportProvider>
    );

    const content = screen.getByTestId('canvas-container-content');
    expect(content).toBeInTheDocument();
    expect(content).toHaveStyle({
      transformOrigin: '0 0',
    });
  });

  it('should apply camera transform to content', () => {
    render(
      <ViewportProvider>
        <CanvasContainer>{null}</CanvasContainer>
      </ViewportProvider>
    );

    const content = screen.getByTestId('canvas-container-content');
    const transform = content.style.transform;

    // Should have translate and scale
    expect(transform).toContain('translate');
    expect(transform).toContain('scale');
  });

  it('should set default cursor style', () => {
    render(
      <ViewportProvider>
        <CanvasContainer>{null}</CanvasContainer>
      </ViewportProvider>
    );

    const container = screen.getByTestId('canvas-container');
    expect(container).toHaveStyle({ cursor: 'default' });
  });

  it('should set data attributes for interaction state', () => {
    render(
      <ViewportProvider>
        <CanvasContainer>{null}</CanvasContainer>
      </ViewportProvider>
    );

    const container = screen.getByTestId('canvas-container');
    expect(container).toHaveAttribute('data-panning');
    expect(container).toHaveAttribute('data-space-pressed');
  });
});
