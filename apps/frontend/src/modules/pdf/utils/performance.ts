/**
 * Performance monitoring utilities
 * Provides instrumentation helpers for tracking PDF rendering and canvas performance
 */

export interface PerformanceMark {
  name: string;
  startTime: number;
}

export interface PerformanceMeasurement {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
}

/**
 * Start a performance measurement
 * @param name Unique name for this measurement
 */
export function startPerformanceMark(name: string): void {
  if (typeof performance !== 'undefined') {
    performance.mark(`${name}-start`);
  }
}

/**
 * End a performance measurement and return the duration
 * @param name Unique name for this measurement (must match startPerformanceMark)
 * @returns Duration in milliseconds, or null if measurement failed
 */
export function endPerformanceMark(name: string): number | null {
  if (typeof performance !== 'undefined') {
    try {
      performance.mark(`${name}-end`);
      const measure = performance.measure(name, `${name}-start`, `${name}-end`);

      // Clean up marks
      performance.clearMarks(`${name}-start`);
      performance.clearMarks(`${name}-end`);
      performance.clearMeasures(name);

      return measure.duration;
    } catch (e) {
      console.warn(`Performance measurement failed for ${name}:`, e);
      return null;
    }
  }
  return null;
}

/**
 * Log a performance measurement to console (debug builds only)
 * @param name Measurement name
 * @param duration Duration in milliseconds
 */
export function logPerformance(name: string, duration: number | null): void {
  if (duration !== null && import.meta.env.DEV) {
    console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
  }
}

/**
 * Measure the execution time of an async function
 * @param name Measurement name
 * @param fn Function to measure
 * @returns Result of the function
 */
export async function measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  startPerformanceMark(name);
  try {
    const result = await fn();
    const duration = endPerformanceMark(name);
    logPerformance(name, duration);
    return result;
  } catch (error) {
    endPerformanceMark(name);
    throw error;
  }
}

/**
 * Measure the execution time of a synchronous function
 * @param name Measurement name
 * @param fn Function to measure
 * @returns Result of the function
 */
export function measureSync<T>(name: string, fn: () => T): T {
  startPerformanceMark(name);
  try {
    const result = fn();
    const duration = endPerformanceMark(name);
    logPerformance(name, duration);
    return result;
  } catch (error) {
    endPerformanceMark(name);
    throw error;
  }
}

/**
 * Simple FPS tracker for monitoring render performance
 */
export class FpsTracker {
  private frames: number[] = [];
  private lastFrameTime = 0;
  private frameRequestId: number | null = null;
  private maxSamples: number;
  private onUpdate: ((fps: number) => void) | undefined = undefined;

  constructor(maxSamples?: number, onUpdate?: (fps: number) => void) {
    this.maxSamples = maxSamples ?? 60;
    this.onUpdate = onUpdate;
  }

  /**
   * Start tracking FPS
   */
  start(): void {
    if (this.frameRequestId !== null) {
      return; // Already running
    }

    const trackFrame = (timestamp: number) => {
      if (this.lastFrameTime > 0) {
        const delta = timestamp - this.lastFrameTime;
        this.frames.push(1000 / delta); // Convert to FPS

        // Keep only the last N samples
        if (this.frames.length > this.maxSamples) {
          this.frames.shift();
        }

        // Calculate average FPS
        if (this.onUpdate && this.frames.length > 0) {
          const avgFps = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
          this.onUpdate(avgFps);
        }
      }

      this.lastFrameTime = timestamp;
      this.frameRequestId = requestAnimationFrame(trackFrame);
    };

    this.frameRequestId = requestAnimationFrame(trackFrame);
  }

  /**
   * Stop tracking FPS
   */
  stop(): void {
    if (this.frameRequestId !== null) {
      cancelAnimationFrame(this.frameRequestId);
      this.frameRequestId = null;
    }
    this.frames = [];
    this.lastFrameTime = 0;
  }

  /**
   * Get current average FPS
   */
  getCurrentFps(): number {
    if (this.frames.length === 0) {
      return 0;
    }
    return this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
  }
}

/**
 * Throttle a function to run at most once per specified interval
 * @param fn Function to throttle
 * @param interval Minimum interval in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  interval: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: number | null = null;

  return function throttled(...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= interval) {
      // Execute immediately if enough time has passed
      lastCall = now;
      fn(...args);
    } else {
      // Schedule execution for the next available slot
      timeoutId ??= window.setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn(...args);
      }, interval - timeSinceLastCall);
    }
  };
}

/**
 * Debounce a function to run only after it hasn't been called for a specified delay
 * @param fn Function to debounce
 * @param delay Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | null = null;

  return function debounced(...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      fn(...args);
    }, delay);
  };
}

/**
 * Batch multiple updates using requestAnimationFrame
 * @param fn Function to call before next frame
 * @returns Function to trigger the batched update
 */
export function batchUpdate(fn: () => void): () => void {
  let frameId: number | null = null;

  return () => {
    frameId ??= requestAnimationFrame(() => {
      frameId = null;
      fn();
    });
  };
}
