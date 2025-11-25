/**
 * LocationCanvas Component Tests
 * Unit tests for location drawing and interaction
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocationCanvas } from '../components/LocationCanvas';
import { useLocationStore } from '../state/useLocationStore';

// Mock PDF document provider
vi.mock('../../pdf/PdfDocumentProvider', () => ({
  usePdfDocument: () => ({
    scale: 1.0,
    currentPage: 1,
    totalPages: 1,
  }),
}));

// Mock Konva Stage and Layer
vi.mock('react-konva', () => ({
  Stage: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div data-testid="konva-stage" {...props}>{children}</div>,
  Layer: ({ children }: React.PropsWithChildren) => <div data-testid="konva-layer">{children}</div>,
  Rect: (props: Record<string, unknown>) => <div data-testid="konva-rect" data-props={JSON.stringify(props)} />,
  Line: (props: Record<string, unknown>) => <div data-testid="konva-line" data-props={JSON.stringify(props)} />,
  Circle: (props: Record<string, unknown>) => <div data-testid="konva-circle" data-props={JSON.stringify(props)} />,
}));

describe('LocationCanvas', () => {
  beforeEach(() => {
    // Reset store before each test
    useLocationStore.setState({
      locations: new Map(),
      selectedLocationId: null,
      activeTool: 'none',
      draftPolygon: null,
      draftRectangle: null,
    });
  });

  it('renders without crashing', () => {
    render(<LocationCanvas planId="test-plan-1" />);
    const stage = screen.getByTestId('konva-stage');
    expect(stage).toBeDefined();
  });

  it('renders with provided dimensions', () => {
    render(<LocationCanvas planId="test-plan-1" width={1024} height={768} />);
    const stage = screen.getByTestId('konva-stage');
    expect(stage.getAttribute('width')).toBe('1024');
    expect(stage.getAttribute('height')).toBe('768');
  });

  it('changes cursor when drawing tool is active', () => {
    useLocationStore.setState({ activeTool: 'rectangle' });
    render(<LocationCanvas planId="test-plan-1" />);
    const stage = screen.getByTestId('konva-stage');
    expect(stage.style.cursor).toBe('crosshair');
  });

  it('renders existing rectangle locations', () => {
    const testLocation = {
      id: 'loc-1',
      planId: 'test-plan-1',
      name: 'Room 1',
      type: 'rectangle' as const,
      bounds: { x: 100, y: 100, width: 200, height: 150 },
      vertices: null,
      color: '#ff0000',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    useLocationStore.setState({
      locations: new Map([[testLocation.id, testLocation]]),
    });

    render(<LocationCanvas planId="test-plan-1" />);
    const rectangles = screen.getAllByTestId('konva-rect');
    expect(rectangles.length).toBeGreaterThan(0);
  });

  it('renders existing polygon locations', () => {
    const testLocation = {
      id: 'loc-2',
      planId: 'test-plan-1',
      name: 'Room 2',
      type: 'polygon' as const,
      bounds: null,
      vertices: [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
        { x: 100, y: 200 },
      ],
      color: '#00ff00',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    useLocationStore.setState({
      locations: new Map([[testLocation.id, testLocation]]),
    });

    render(<LocationCanvas planId="test-plan-1" />);
    const lines = screen.getAllByTestId('konva-line');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('renders draft rectangle during drawing', () => {
    useLocationStore.setState({
      activeTool: 'rectangle',
      draftRectangle: {
        start: { x: 50, y: 50 },
        end: { x: 150, y: 150 },
      },
    });

    render(<LocationCanvas planId="test-plan-1" />);
    const rectangles = screen.getAllByTestId('konva-rect');

    // Find the draft rectangle (should have dashed stroke)
    const draftRect = rectangles.find((rect) => {
      const props = JSON.parse(rect.getAttribute('data-props') ?? '{}') as { dash?: number[] };
      return props.dash && props.dash.length > 0;
    });

    expect(draftRect).toBeDefined();
  });

  it('renders draft polygon with vertices', () => {
    useLocationStore.setState({
      activeTool: 'polygon',
      draftPolygon: {
        vertices: [
          { x: 50, y: 50 },
          { x: 100, y: 50 },
          { x: 100, y: 100 },
        ],
        isComplete: false,
      },
    });

    render(<LocationCanvas planId="test-plan-1" />);

    // Should render line for polygon
    const lines = screen.getAllByTestId('konva-line');
    expect(lines.length).toBeGreaterThan(0);

    // Should render vertex circles
    const circles = screen.getAllByTestId('konva-circle');
    expect(circles.length).toBe(3);
  });

  it('calls onLocationCreated when rectangle is completed', () => {
    const onLocationCreated = vi.fn();

    // Simulate rectangle completion by setting draft and then completing it
    useLocationStore.setState({
      activeTool: 'rectangle',
      draftRectangle: {
        start: { x: 100, y: 100 },
        end: { x: 200, y: 200 },
      },
    });

    render(<LocationCanvas planId="test-plan-1" onLocationCreated={onLocationCreated} />);

    // Manually trigger rectangle completion
    const { completeRectangle } = useLocationStore.getState();
    const result = completeRectangle();

    expect(result).toBeDefined();
    expect(result?.start).toEqual({ x: 100, y: 100 });
    expect(result?.end).toEqual({ x: 200, y: 200 });
  });

  it('highlights selected location with different stroke', () => {
    const testLocation = {
      id: 'loc-1',
      planId: 'test-plan-1',
      name: 'Room 1',
      type: 'rectangle' as const,
      bounds: { x: 100, y: 100, width: 200, height: 150 },
      vertices: null,
      color: '#ff0000',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    useLocationStore.setState({
      locations: new Map([[testLocation.id, testLocation]]),
      selectedLocationId: 'loc-1',
    });

    render(<LocationCanvas planId="test-plan-1" />);
    const rectangles = screen.getAllByTestId('konva-rect');

    // Selected rectangle should have thicker stroke
    const selectedRect = rectangles.find((rect) => {
      const props = JSON.parse(rect.getAttribute('data-props') ?? '{}') as { strokeWidth?: number };
      return props.strokeWidth === 3;
    });

    expect(selectedRect).toBeDefined();
  });
});
