/**
 * Canvas Gestures Hook
 * Unified gesture handling for pan, zoom, and multi-touch interactions
 *
 * Handles:
 * - Wheel events for zoom (with ctrl/cmd) and pan
 * - Pointer events for drag panning (middle button and space+drag)
 * - Multi-touch gestures (pinch-to-zoom and two-finger pan)
 */

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { useEffect, useCallback, useRef, useState } from 'react';
import { useViewportActions, useZoom } from '../contexts/ViewportContext';
import type { Point } from '../stores/useViewportStore';
import { ZOOM_MIN, ZOOM_MAX } from '../stores/useViewportStore';

/**
 * Normalize wheel deltaMode to pixels
 * Handles different deltaMode values across browsers
 */
const DELTA_LINE = 40; // Approximate pixels per line
const DELTA_PAGE = 800; // Approximate pixels per page

function normalizeWheelDelta(event: WheelEvent): { deltaX: number; deltaY: number } {
  const { deltaMode } = event;
  let { deltaX, deltaY } = event;

  // Convert to pixels based on deltaMode
  if (deltaMode === 1) {
    // DOM_DELTA_LINE
    deltaX *= DELTA_LINE;
    deltaY *= DELTA_LINE;
  } else if (deltaMode === 2) {
    // DOM_DELTA_PAGE
    deltaX *= DELTA_PAGE;
    deltaY *= DELTA_PAGE;
  }

  return { deltaX, deltaY };
}

/**
 * Throttle function for performance
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Props for useCanvasGestures hook
 */
export interface UseCanvasGesturesProps<T extends HTMLElement = HTMLElement> {
  /**
   * Ref to the canvas container element
   */
  containerRef: React.RefObject<T>;

  /**
   * Whether gestures are enabled
   */
  enabled?: boolean;

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
}

/**
 * Track active pointers for multi-touch gestures
 */
interface ActivePointer {
  id: number;
  x: number;
  y: number;
}

/**
 * Hook to handle canvas pan/zoom gestures
 */
export function useCanvasGestures<T extends HTMLElement = HTMLElement>({
  containerRef,
  enabled = true,
  onPanStart,
  onPanEnd,
  onZoomStart,
  onZoomEnd,
}: UseCanvasGesturesProps<T>) {
  const { setZoom, pan } = useViewportActions();
  const zoom = useZoom();

  // Track pointer state
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const activePointersRef = useRef<Map<number, ActivePointer>>(new Map());
  const lastPanPositionRef = useRef<Point | null>(null);
  const lastWheelTimeRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  /**
   * Handle wheel events for zoom and pan
   */
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      if (!enabled) return;

      event.preventDefault();

      const now = Date.now();
      // Throttle to ~60fps (16ms)
      if (now - lastWheelTimeRef.current < 16) {
        return;
      }
      lastWheelTimeRef.current = now;

      const { deltaX, deltaY } = normalizeWheelDelta(event);
      const isZoomGesture = event.ctrlKey || event.metaKey;

      if (isZoomGesture) {
        // Zoom at cursor
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        onZoomStart?.();

        // Calculate cursor position relative to container
        const cursorScreen: Point = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };

        // Calculate zoom delta (negative deltaY means zoom in)
        const zoomDelta = -deltaY * 0.002;
        const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * (1 + zoomDelta)));

        setZoom(newZoom, cursorScreen);

        // Debounce zoom end callback
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
        }
        rafIdRef.current = requestAnimationFrame(() => {
          onZoomEnd?.();
          rafIdRef.current = null;
        });
      } else {
        // Pan
        // Scale pan delta by zoom (faster pan at higher zoom)
        const panDelta: Point = {
          x: -deltaX / zoom,
          y: -deltaY / zoom,
        };

        pan(panDelta);
      }
    },
    [enabled, zoom, containerRef, setZoom, pan, onZoomStart, onZoomEnd]
  );

  /**
   * Handle keyboard events for space key (pan mode)
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;
      if (event.key === ' ' && !isSpacePressed) {
        setIsSpacePressed(true);
        // Prevent page scroll
        event.preventDefault();
      }
    },
    [enabled, isSpacePressed]
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;
      if (event.key === ' ') {
        setIsSpacePressed(false);
      }
    },
    [enabled]
  );

  /**
   * Handle pointer down - start drag pan
   */
  const handlePointerDown = useCallback(
    (event: PointerEvent) => {
      if (!enabled) return;

      const container = containerRef.current;
      if (!container) return;

      // Check if clicking on a Konva canvas - don't start pan for left-click on Konva
      const target = event.target as HTMLElement;
      const isKonvaCanvas = target.tagName === 'CANVAS' && target.closest('.konvajs-content');

      // Pan conditions:
      // - Middle button always pans
      // - Space + left button pans
      // - Left button pans if NOT on a Konva canvas (allows Konva to handle its own clicks)
      const shouldPan = event.button === 1 ||
        (event.button === 0 && isSpacePressed) ||
        (event.button === 0 && !isKonvaCanvas);

      if (shouldPan) {
        event.preventDefault();
        container.setPointerCapture(event.pointerId);

        const rect = container.getBoundingClientRect();
        lastPanPositionRef.current = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };

        setIsPanning(true);
        onPanStart?.();
      }

      // Track all pointers for multi-touch
      const rect = container.getBoundingClientRect();
      activePointersRef.current.set(event.pointerId, {
        id: event.pointerId,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    },
    [enabled, containerRef, isSpacePressed, onPanStart]
  );

  /**
   * Handle pointer move - drag pan and multi-touch gestures
   */
  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!enabled) return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const currentPos: Point = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      // Update active pointer position
      const pointer = activePointersRef.current.get(event.pointerId);
      if (pointer) {
        activePointersRef.current.set(event.pointerId, {
          ...pointer,
          x: currentPos.x,
          y: currentPos.y,
        });
      }

      const pointers = Array.from(activePointersRef.current.values());

      // Handle multi-touch gestures (2 fingers)
      if (pointers.length === 2) {
        const [p1, p2] = pointers;

        if (!p1 || !p2) return;

        // Calculate current distance and center
        const currentDist = Math.sqrt(
          Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
        );
        const currentCenter: Point = {
          x: (p1.x + p2.x) / 2,
          y: (p1.y + p2.y) / 2,
        };

        // Use a stored initial distance for pinch-to-zoom
        if (!container.dataset['initialPinchDist']) {
          container.dataset['initialPinchDist'] = String(currentDist);
          container.dataset['initialZoom'] = String(zoom);
          onZoomStart?.();
        } else {
          const initialDist = parseFloat(container.dataset['initialPinchDist']);
          const initialZoom = parseFloat(container.dataset['initialZoom'] ?? String(zoom));

          // Calculate zoom based on distance change
          const scale = currentDist / initialDist;
          const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, initialZoom * scale));

          setZoom(newZoom, currentCenter);
        }

        return;
      }

      // Single pointer drag pan
      if (isPanning && lastPanPositionRef.current) {
        const delta: Point = {
          x: (currentPos.x - lastPanPositionRef.current.x) / zoom,
          y: (currentPos.y - lastPanPositionRef.current.y) / zoom,
        };

        pan(delta);
        lastPanPositionRef.current = currentPos;
      }
    },
    [enabled, containerRef, isPanning, zoom, setZoom, pan, onZoomStart]
  );

  /**
   * Handle pointer up/cancel - end drag pan
   */
  const handlePointerUpOrCancel = useCallback(
    (event: PointerEvent) => {
      if (!enabled) return;

      const container = containerRef.current;
      if (!container) return;

      // Remove from active pointers
      activePointersRef.current.delete(event.pointerId);

      // Clear pinch data if no more pointers
      if (activePointersRef.current.size === 0) {
        delete container.dataset['initialPinchDist'];
        delete container.dataset['initialZoom'];
        onZoomEnd?.();
      }

      // Release pointer capture
      if (container.hasPointerCapture(event.pointerId)) {
        container.releasePointerCapture(event.pointerId);
      }

      if (isPanning) {
        setIsPanning(false);
        lastPanPositionRef.current = null;
        onPanEnd?.();
      }
    },
    [enabled, containerRef, isPanning, onPanEnd, onZoomEnd]
  );

  /**
   * Setup event listeners
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) return;

    // Wheel events (passive: false to prevent default)
    // Use capture phase to intercept before Konva/children
    const throttledWheel = throttle(handleWheel, 16);
    container.addEventListener('wheel', throttledWheel, { passive: false, capture: true });

    // Keyboard events
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Pointer events
    // Use capture phase for space+drag and middle-button pan to intercept before children
    container.addEventListener('pointerdown', handlePointerDown, { capture: true });
    container.addEventListener('pointermove', handlePointerMove, { capture: true });
    container.addEventListener('pointerup', handlePointerUpOrCancel, { capture: true });
    container.addEventListener('pointercancel', handlePointerUpOrCancel, { capture: true });

    return () => {
      container.removeEventListener('wheel', throttledWheel, { capture: true });
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      container.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      container.removeEventListener('pointermove', handlePointerMove, { capture: true });
      container.removeEventListener('pointerup', handlePointerUpOrCancel, { capture: true });
      container.removeEventListener('pointercancel', handlePointerUpOrCancel, { capture: true });

      // Cleanup RAF
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [
    enabled,
    containerRef,
    handleWheel,
    handleKeyDown,
    handleKeyUp,
    handlePointerDown,
    handlePointerMove,
    handlePointerUpOrCancel,
  ]);

  return {
    isPanning,
    isSpacePressed,
  };
}
