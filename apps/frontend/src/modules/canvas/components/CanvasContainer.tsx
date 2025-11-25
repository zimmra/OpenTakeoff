/**
 * Canvas Container Component
 * Main container for the canvas with pan/zoom gesture handling
 *
 * Provides:
 * - Unified pan and zoom interactions
 * - Touch gesture support (pinch-to-zoom, two-finger pan)
 * - Space + drag and middle-button panning
 * - Smooth zoom-at-cursor behavior
 */

import { useRef, type ReactNode, type CSSProperties } from 'react';
import { useCanvasGestures } from '../hooks/useCanvasGestures';
import { useCamera, useZoom } from '../contexts/ViewportContext';

/**
 * Props for CanvasContainer
 */
export interface CanvasContainerProps {
  /**
   * Child elements to render inside the container
   */
  children: ReactNode;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Additional inline styles
   */
  style?: CSSProperties;

  /**
   * Whether gestures are enabled
   */
  enabled?: boolean;

  /**
   * Disable camera transform application (useful when children apply their own transforms)
   * When true, CanvasContainer only provides gesture handling without transforming children
   */
  disableTransform?: boolean;

  /**
   * Callback when panning starts
   */
  onPanStart?: () => void;

  /**
   * Callback when panning ends
   */
  onPanEnd?: () => void;

  /**
   * Callback when zooming starts
   */
  onZoomStart?: () => void;

  /**
   * Callback when zooming ends
   */
  onZoomEnd?: () => void;

  /**
   * Optional data-testid for testing
   */
  'data-testid'?: string;
}

/**
 * Main canvas container component with pan/zoom gesture handling
 *
 * This component:
 * - Applies CSS transforms for smooth pan/zoom
 * - Handles all pointer/wheel/keyboard events for interactions
 * - Provides touch-action: none to prevent native gestures
 * - Uses requestAnimationFrame for smooth visual updates
 *
 * @example
 * ```tsx
 * <CanvasContainer>
 *   <PdfCanvas />
 *   <KonvaLayer />
 * </CanvasContainer>
 * ```
 */
export function CanvasContainer({
  children,
  className = '',
  style,
  enabled = true,
  disableTransform = false,
  onPanStart,
  onPanEnd,
  onZoomStart,
  onZoomEnd,
  'data-testid': dataTestId = 'canvas-container',
}: CanvasContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const camera = useCamera();
  const zoom = useZoom();

  // Setup gesture handlers
  const { isPanning, isSpacePressed } = useCanvasGestures<HTMLDivElement>({
    containerRef: containerRef as unknown as React.RefObject<HTMLDivElement>,
    enabled,
    ...(onPanStart && { onPanStart }),
    ...(onPanEnd && { onPanEnd }),
    ...(onZoomStart && { onZoomStart }),
    ...(onZoomEnd && { onZoomEnd }),
  });

  // Compute cursor style based on interaction state
  const cursorStyle = isPanning
    ? 'grabbing'
    : isSpacePressed
      ? 'grab'
      : 'default';

  // Apply camera transform to children (unless disabled)
  // Note: This transform is applied to the inner content wrapper,
  // not the container itself, to keep pointer events working correctly
  const transformStyle: CSSProperties = disableTransform
    ? {}
    : {
        transform: `translate(${-camera.x * zoom}px, ${-camera.y * zoom}px) scale(${zoom})`,
        transformOrigin: '0 0',
        willChange: isPanning || isSpacePressed ? 'transform' : undefined,
      };

  return (
    <div
      ref={containerRef}
      className={`canvas-container ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        cursor: cursorStyle,
        touchAction: 'none', // Disable native touch gestures
        ...style,
      }}
      data-testid={dataTestId}
      data-panning={isPanning}
      data-space-pressed={isSpacePressed}
    >
      {/* Content wrapper with camera transform */}
      <div
        className="canvas-content"
        style={transformStyle}
        data-testid={`${dataTestId}-content`}
      >
        {children}
      </div>
    </div>
  );
}
