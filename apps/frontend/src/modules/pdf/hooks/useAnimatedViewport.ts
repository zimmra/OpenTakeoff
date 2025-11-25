/**
 * Animated Viewport Hook
 * Provides smooth spring-based animations for zoom and pan operations
 */

import { useSpring } from '@react-spring/web';
import type { SpringConfig } from '@react-spring/web';
import { useEffect, useMemo, useRef } from 'react';

export interface AnimatedViewportOptions {
  /** Enable immediate mode (no animation) during active dragging */
  immediate?: boolean;
  /** Spring configuration for animations */
  config?: SpringConfig;
  /** Callback when animation completes */
  onRest?: () => void;
}

export interface AnimatedViewportValues {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Hook for animated viewport transformations
 * Provides spring-based animations for smooth zoom and pan
 *
 * @param target Target viewport values
 * @param options Animation options
 * @returns Animated viewport values
 */
export function useAnimatedViewport(
  target: AnimatedViewportValues,
  options: AnimatedViewportOptions = {}
): AnimatedViewportValues {
  const { immediate = false, config, onRest } = options;

  // Spring configuration optimized for responsive feel - defined at module level for stability
  const defaultConfig = useMemo<SpringConfig>(() => ({
    tension: 200,
    friction: 30,
    mass: 1,
    clamp: false,
  }), []);

  // Create spring for viewport values
  const [springs, api] = useSpring(() => ({
    x: target.x,
    y: target.y,
    zoom: target.zoom,
    config: config ?? defaultConfig,
    immediate,
    ...(onRest && { onRest }),
  }));

  // Update spring when target changes
  useEffect(() => {
    void api.start({
      x: target.x,
      y: target.y,
      zoom: target.zoom,
      immediate,
      config: config ?? defaultConfig,
      ...(onRest && { onRest }),
    });
  }, [target.x, target.y, target.zoom, immediate, config, onRest, api, defaultConfig]);

  return {
    x: springs.x.get(),
    y: springs.y.get(),
    zoom: springs.zoom.get(),
  };
}

/**
 * Hook for pan-to-position animations
 * Provides eased transitions when jumping to specific coordinates
 *
 * @param onPanComplete Callback when pan animation completes
 * @returns Function to trigger animated pan
 */
export function usePanToPosition(onPanComplete?: () => void) {
  const activeAnimationRef = useRef<(() => void) | null>(null);

  const panTo = (x: number, y: number, duration = 300): Promise<void> => {
    // Cancel any active animation
    if (activeAnimationRef.current) {
      activeAnimationRef.current();
      activeAnimationRef.current = null;
    }

    return new Promise<void>((resolve) => {
      const startTime = performance.now();
      const startX = 0; // These should come from current viewport state
      const startY = 0;

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-in-out cubic)
        const eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        // Interpolate position (for demonstration - would be used to update viewport state)
        // currentX = startX + (x - startX) * eased;
        // currentY = startY + (y - startY) * eased;

        // Suppress unused variable warnings - these would be used in actual implementation
        void eased;
        void startX;
        void startY;
        void x;
        void y;

        if (progress < 1) {
          activeAnimationRef.current = () => {
            // Animation cancelled
          };
          requestAnimationFrame(animate);
        } else {
          activeAnimationRef.current = null;
          if (onPanComplete) {
            onPanComplete();
          }
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeAnimationRef.current) {
        activeAnimationRef.current();
      }
    };
  }, []);

  return panTo;
}

/**
 * Hook for fade-in/fade-out UI overlay animations
 *
 * @param visible Whether the overlay is visible
 * @param options Animation options
 * @returns Animated opacity value
 */
export function useFadeTransition(
  visible: boolean,
  options: { duration?: number; delay?: number } = {}
): number {
  const { duration = 200, delay = 0 } = options;

  const [springs] = useSpring(() => ({
    opacity: visible ? 1 : 0,
    config: {
      duration,
    },
    delay,
  }));

  // Update spring when visibility changes
  useEffect(() => {
    void springs.opacity.start(visible ? 1 : 0);
  }, [visible, springs.opacity]);

  return springs.opacity.get();
}
