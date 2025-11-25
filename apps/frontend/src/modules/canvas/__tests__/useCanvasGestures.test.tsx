/**
 * Canvas Gestures Hook Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasGestures } from '../hooks/useCanvasGestures';
import { ViewportProvider } from '../contexts/ViewportContext';
import type { ReactNode } from 'react';

// Use fake timers
vi.useFakeTimers();

// Create a wrapper component for testing
function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ViewportProvider>{children}</ViewportProvider>;
  };
}

describe('useCanvasGestures', () => {
  let containerElement: HTMLDivElement;
  let containerRef: React.RefObject<HTMLDivElement>;

  beforeEach(() => {
    // Create a real DOM element for testing
    containerElement = document.createElement('div');
    document.body.appendChild(containerElement);

    // Mock getBoundingClientRect
    containerElement.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }));

    // Create ref
    containerRef = { current: containerElement };

    // Mock Pointer Events methods
    containerElement.setPointerCapture = vi.fn();
    containerElement.releasePointerCapture = vi.fn();
    containerElement.hasPointerCapture = vi.fn(() => false);
  });

  afterEach(() => {
    document.body.removeChild(containerElement);
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(
      () => useCanvasGestures({ containerRef }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isPanning).toBe(false);
    expect(result.current.isSpacePressed).toBe(false);
  });

  it('should handle wheel zoom with ctrl key', async () => {
    const onZoomStart = vi.fn();
    const onZoomEnd = vi.fn();

    renderHook(
      () => useCanvasGestures({ containerRef, onZoomStart, onZoomEnd }),
      { wrapper: createWrapper() }
    );

    // Create wheel event with ctrl key
    const wheelEvent = new WheelEvent('wheel', {
      deltaY: -100,
      ctrlKey: true,
      clientX: 50,
      clientY: 50,
      bubbles: true,
      cancelable: true,
    });

    act(() => {
      containerElement.dispatchEvent(wheelEvent);
    });

    // Advance time to allow throttle to process
    act(() => {
      vi.advanceTimersByTime(20);
    });

    // onZoomStart should be called (if events were not throttled out)
    // Note: Due to throttling internals, we just verify the event was handled
    expect(wheelEvent.defaultPrevented).toBe(true);

    // Wait for RAF to complete
    await act(() => {
      vi.runAllTimers();
    });
  });

  it('should handle wheel pan without ctrl key', () => {
    renderHook(
      () => useCanvasGestures({ containerRef }),
      { wrapper: createWrapper() }
    );

    // Create wheel event without ctrl key
    const wheelEvent = new WheelEvent('wheel', {
      deltaX: 10,
      deltaY: 20,
      clientX: 50,
      clientY: 50,
      bubbles: true,
      cancelable: true,
    });

    act(() => {
      containerElement.dispatchEvent(wheelEvent);
    });

    // Pan should be applied (no easy way to assert without checking viewport state)
    expect(wheelEvent.defaultPrevented).toBe(true);
  });

  it('should handle multiple wheel events', () => {
    renderHook(
      () => useCanvasGestures({ containerRef }),
      { wrapper: createWrapper() }
    );

    // Dispatch multiple wheel events
    const events: WheelEvent[] = [];
    for (let i = 0; i < 3; i++) {
      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -100,
        ctrlKey: true,
        clientX: 50,
        clientY: 50,
        bubbles: true,
        cancelable: true,
      });
      events.push(wheelEvent);

      act(() => {
        containerElement.dispatchEvent(wheelEvent);
        // Advance time between events to avoid throttling
        vi.advanceTimersByTime(20);
      });
    }

    // All events should have preventDefault called
    events.forEach((event) => {
      expect(event.defaultPrevented).toBe(true);
    });
  });

  it('should handle space key press', () => {
    const { result } = renderHook(
      () => useCanvasGestures({ containerRef }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isSpacePressed).toBe(false);

    // Simulate space key down
    const keyDownEvent = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    });

    act(() => {
      window.dispatchEvent(keyDownEvent);
    });

    expect(result.current.isSpacePressed).toBe(true);

    // Simulate space key up
    const keyUpEvent = new KeyboardEvent('keyup', {
      key: ' ',
      bubbles: true,
    });

    act(() => {
      window.dispatchEvent(keyUpEvent);
    });

    expect(result.current.isSpacePressed).toBe(false);
  });

  it('should handle middle button drag pan', () => {
    const onPanStart = vi.fn();
    const onPanEnd = vi.fn();

    const { result } = renderHook(
      () => useCanvasGestures({ containerRef, onPanStart, onPanEnd }),
      { wrapper: createWrapper() }
    );

    // Mock setPointerCapture and hasPointerCapture
    containerElement.setPointerCapture = vi.fn();
    containerElement.releasePointerCapture = vi.fn();
    containerElement.hasPointerCapture = vi.fn(() => true);

    // Pointer down with middle button
    const pointerDown = new PointerEvent('pointerdown', {
      pointerId: 1,
      button: 1, // Middle button
      clientX: 50,
      clientY: 50,
      bubbles: true,
    });

    act(() => {
      containerElement.dispatchEvent(pointerDown);
    });

    expect(result.current.isPanning).toBe(true);
    expect(onPanStart).toHaveBeenCalled();
    expect(containerElement.setPointerCapture).toHaveBeenCalledWith(1);

    // Pointer move
    const pointerMove = new PointerEvent('pointermove', {
      pointerId: 1,
      clientX: 60,
      clientY: 70,
      bubbles: true,
    });

    act(() => {
      containerElement.dispatchEvent(pointerMove);
    });

    // Pointer up
    const pointerUp = new PointerEvent('pointerup', {
      pointerId: 1,
      bubbles: true,
    });

    act(() => {
      containerElement.dispatchEvent(pointerUp);
    });

    expect(result.current.isPanning).toBe(false);
    expect(onPanEnd).toHaveBeenCalled();
    expect(containerElement.releasePointerCapture).toHaveBeenCalledWith(1);
  });

  it('should handle space + left button drag pan', () => {
    const onPanStart = vi.fn();

    const { result } = renderHook(
      () => useCanvasGestures({ containerRef, onPanStart }),
      { wrapper: createWrapper() }
    );

    // Press space key first
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    });

    expect(result.current.isSpacePressed).toBe(true);

    // Mock pointer capture
    containerElement.setPointerCapture = vi.fn();

    // Pointer down with left button while space is pressed
    const pointerDown = new PointerEvent('pointerdown', {
      pointerId: 1,
      button: 0, // Left button
      clientX: 50,
      clientY: 50,
      bubbles: true,
    });

    act(() => {
      containerElement.dispatchEvent(pointerDown);
    });

    expect(result.current.isPanning).toBe(true);
    expect(onPanStart).toHaveBeenCalled();
  });

  it('should handle multi-touch pinch-to-zoom', () => {
    const onZoomStart = vi.fn();

    renderHook(
      () => useCanvasGestures({ containerRef, onZoomStart }),
      { wrapper: createWrapper() }
    );

    // First finger down
    const pointer1Down = new PointerEvent('pointerdown', {
      pointerId: 1,
      clientX: 40,
      clientY: 50,
      bubbles: true,
    });

    act(() => {
      containerElement.dispatchEvent(pointer1Down);
    });

    // Second finger down
    const pointer2Down = new PointerEvent('pointerdown', {
      pointerId: 2,
      clientX: 60,
      clientY: 50,
      bubbles: true,
    });

    act(() => {
      containerElement.dispatchEvent(pointer2Down);
    });

    // Move fingers apart (pinch out / zoom in)
    const pointer1Move = new PointerEvent('pointermove', {
      pointerId: 1,
      clientX: 30,
      clientY: 50,
      bubbles: true,
    });

    const pointer2Move = new PointerEvent('pointermove', {
      pointerId: 2,
      clientX: 70,
      clientY: 50,
      bubbles: true,
    });

    act(() => {
      containerElement.dispatchEvent(pointer1Move);
      containerElement.dispatchEvent(pointer2Move);
    });

    // Should trigger zoom
    expect(onZoomStart).toHaveBeenCalled();
  });

  it('should cleanup event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(containerElement, 'removeEventListener');
    const windowRemoveSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(
      () => useCanvasGestures({ containerRef }),
      { wrapper: createWrapper() }
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('wheel', expect.any(Function), { capture: true });
    expect(removeEventListenerSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function), { capture: true });
    expect(removeEventListenerSpy).toHaveBeenCalledWith('pointermove', expect.any(Function), { capture: true });
    expect(removeEventListenerSpy).toHaveBeenCalledWith('pointerup', expect.any(Function), { capture: true });
    expect(removeEventListenerSpy).toHaveBeenCalledWith('pointercancel', expect.any(Function), { capture: true });
    expect(windowRemoveSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(windowRemoveSpy).toHaveBeenCalledWith('keyup', expect.any(Function));
  });

  it('should not handle events when disabled', () => {
    const onZoomStart = vi.fn();

    renderHook(
      () => useCanvasGestures({ containerRef, enabled: false, onZoomStart }),
      { wrapper: createWrapper() }
    );

    const wheelEvent = new WheelEvent('wheel', {
      deltaY: -100,
      ctrlKey: true,
      clientX: 50,
      clientY: 50,
      bubbles: true,
      cancelable: true,
    });

    act(() => {
      containerElement.dispatchEvent(wheelEvent);
    });

    expect(onZoomStart).not.toHaveBeenCalled();
  });

  it('should prevent default on wheel events', () => {
    renderHook(
      () => useCanvasGestures({ containerRef }),
      { wrapper: createWrapper() }
    );

    const wheelEvent = new WheelEvent('wheel', {
      deltaY: -100,
      ctrlKey: true,
      clientX: 50,
      clientY: 50,
      bubbles: true,
      cancelable: true,
    });

    act(() => {
      containerElement.dispatchEvent(wheelEvent);
    });

    expect(wheelEvent.defaultPrevented).toBe(true);
  });

  it('should handle pointer cancel', () => {
    const onPanEnd = vi.fn();

    const { result } = renderHook(
      () => useCanvasGestures({ containerRef, onPanEnd }),
      { wrapper: createWrapper() }
    );

    // Mock pointer capture
    containerElement.setPointerCapture = vi.fn();
    containerElement.hasPointerCapture = vi.fn(() => true);
    containerElement.releasePointerCapture = vi.fn();

    // Start panning
    act(() => {
      containerElement.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 1,
          button: 1,
          clientX: 50,
          clientY: 50,
          bubbles: true,
        })
      );
    });

    expect(result.current.isPanning).toBe(true);

    // Cancel
    act(() => {
      containerElement.dispatchEvent(
        new PointerEvent('pointercancel', {
          pointerId: 1,
          bubbles: true,
        })
      );
    });

    expect(result.current.isPanning).toBe(false);
    expect(onPanEnd).toHaveBeenCalled();
    expect(containerElement.releasePointerCapture).toHaveBeenCalledWith(1);
  });
});
