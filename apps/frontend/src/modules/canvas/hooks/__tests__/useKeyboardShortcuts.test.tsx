/**
 * Tests for useCanvasKeyboardShortcuts hook
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCanvasKeyboardShortcuts } from '../useKeyboardShortcuts';
import { useViewportStore } from '../../stores/useViewportStore';

// Mock the viewport store
vi.mock('../../stores/useViewportStore', () => ({
  useViewportStore: vi.fn(() => ({
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitToViewport: vi.fn(),
    resetZoom: vi.fn(),
    pan: vi.fn(),
  })),
}));

describe('useCanvasKeyboardShortcuts', () => {
  let mockZoomIn: ReturnType<typeof vi.fn>;
  let mockZoomOut: ReturnType<typeof vi.fn>;
  let mockFitToViewport: ReturnType<typeof vi.fn>;
  let mockResetZoom: ReturnType<typeof vi.fn>;
  let mockPan: ReturnType<typeof vi.fn>;
  let mockOnToolChange: ReturnType<typeof vi.fn>;
  let mockOnDelete: ReturnType<typeof vi.fn>;
  let mockOnToggleHelp: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockZoomIn = vi.fn();
    mockZoomOut = vi.fn();
    mockFitToViewport = vi.fn();
    mockResetZoom = vi.fn();
    mockPan = vi.fn();
    mockOnToolChange = vi.fn();
    mockOnDelete = vi.fn();
    mockOnToggleHelp = vi.fn();

    vi.mocked(useViewportStore).mockReturnValue({
      zoomIn: mockZoomIn,
      zoomOut: mockZoomOut,
      fitToViewport: mockFitToViewport,
      resetZoom: mockResetZoom,
      pan: mockPan,
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const simulateKeyDown = (
    key: string,
    options: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {}
  ) => {
    const event = new KeyboardEvent('keydown', {
      key,
      ctrlKey: options.ctrlKey ?? false,
      metaKey: options.metaKey ?? false,
      shiftKey: options.shiftKey ?? false,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);
    return event;
  };

  describe('Zoom shortcuts', () => {
    it('should zoom in on Ctrl/Cmd + +', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          enabled: true,
        })
      );

      act(() => {
        simulateKeyDown('+', { ctrlKey: true });
      });

      expect(mockZoomIn).toHaveBeenCalledTimes(1);
    });

    it('should zoom in on Ctrl/Cmd + =', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          enabled: true,
        })
      );

      act(() => {
        simulateKeyDown('=', { metaKey: true });
      });

      expect(mockZoomIn).toHaveBeenCalledTimes(1);
    });

    it('should zoom out on Ctrl/Cmd + -', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          enabled: true,
        })
      );

      act(() => {
        simulateKeyDown('-', { ctrlKey: true });
      });

      expect(mockZoomOut).toHaveBeenCalledTimes(1);
    });

    it('should fit to viewport on Ctrl/Cmd + 0', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          enabled: true,
        })
      );

      act(() => {
        simulateKeyDown('0', { ctrlKey: true });
      });

      expect(mockFitToViewport).toHaveBeenCalledTimes(1);
    });

    it('should reset zoom to 100% on Ctrl/Cmd + 1', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          enabled: true,
        })
      );

      act(() => {
        simulateKeyDown('1', { metaKey: true });
      });

      expect(mockResetZoom).toHaveBeenCalledTimes(1);
    });
  });

  describe('Pan shortcuts', () => {
    it('should pan up on arrow up', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          enabled: true,
        })
      );

      act(() => {
        simulateKeyDown('ArrowUp');
      });

      expect(mockPan).toHaveBeenCalledWith({ x: 0, y: -50 });
    });

    it('should pan down on arrow down', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          enabled: true,
        })
      );

      act(() => {
        simulateKeyDown('ArrowDown');
      });

      expect(mockPan).toHaveBeenCalledWith({ x: 0, y: 50 });
    });

    it('should pan left on arrow left', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          enabled: true,
        })
      );

      act(() => {
        simulateKeyDown('ArrowLeft');
      });

      expect(mockPan).toHaveBeenCalledWith({ x: -50, y: 0 });
    });

    it('should pan right on arrow right', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          enabled: true,
        })
      );

      act(() => {
        simulateKeyDown('ArrowRight');
      });

      expect(mockPan).toHaveBeenCalledWith({ x: 50, y: 0 });
    });

    it('should fast pan when Shift is held', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          enabled: true,
        })
      );

      act(() => {
        simulateKeyDown('ArrowUp', { shiftKey: true });
      });

      expect(mockPan).toHaveBeenCalledWith({ x: 0, y: -200 });
    });
  });

  describe('Tool selection shortcuts', () => {
    it('should switch to stamp tool on S key', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          enabled: true,
          onToolChange: mockOnToolChange,
        })
      );

      act(() => {
        simulateKeyDown('s');
      });

      expect(mockOnToolChange).toHaveBeenCalledWith('stamp');
    });

    it('should switch to rectangle tool on R key', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          enabled: true,
          onToolChange: mockOnToolChange,
        })
      );

      act(() => {
        simulateKeyDown('r');
      });

      expect(mockOnToolChange).toHaveBeenCalledWith('rectangle');
    });

    it('should switch to line tool on L key', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          enabled: true,
          onToolChange: mockOnToolChange,
        })
      );

      act(() => {
        simulateKeyDown('l');
      });

      expect(mockOnToolChange).toHaveBeenCalledWith('line');
    });

    it('should switch to select tool on V key', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          enabled: true,
          onToolChange: mockOnToolChange,
        })
      );

      act(() => {
        simulateKeyDown('v');
      });

      expect(mockOnToolChange).toHaveBeenCalledWith('select');
    });

    it('should switch to select tool on Escape key', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          enabled: true,
          onToolChange: mockOnToolChange,
        })
      );

      act(() => {
        simulateKeyDown('Escape');
      });

      expect(mockOnToolChange).toHaveBeenCalledWith('select');
    });

    it('should handle uppercase tool keys', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          enabled: true,
          onToolChange: mockOnToolChange,
        })
      );

      act(() => {
        simulateKeyDown('S');
      });

      expect(mockOnToolChange).toHaveBeenCalledWith('stamp');
    });
  });

  describe('Delete shortcuts', () => {
    it('should call onDelete on Delete key', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          enabled: true,
          onDelete: mockOnDelete,
        })
      );

      act(() => {
        simulateKeyDown('Delete');
      });

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    it('should call onDelete on Backspace key', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          enabled: true,
          onDelete: mockOnDelete,
        })
      );

      act(() => {
        simulateKeyDown('Backspace');
      });

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('Help panel shortcut', () => {
    it('should toggle help panel on ? key', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          enabled: true,
          onToggleHelp: mockOnToggleHelp,
        })
      );

      act(() => {
        simulateKeyDown('?');
      });

      expect(mockOnToggleHelp).toHaveBeenCalledTimes(1);
    });
  });

  describe('Input element guards', () => {
    it('should not trigger shortcuts when typing in input element', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          enabled: true,
          onToolChange: mockOnToolChange,
        })
      );

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 's',
          bubbles: true,
          cancelable: true,
        });
        input.dispatchEvent(event);
      });

      expect(mockOnToolChange).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it('should not trigger shortcuts when typing in textarea', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          enabled: true,
          onDelete: mockOnDelete,
        })
      );

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'Delete',
          bubbles: true,
          cancelable: true,
        });
        textarea.dispatchEvent(event);
      });

      expect(mockOnDelete).not.toHaveBeenCalled();

      document.body.removeChild(textarea);
    });
  });

  describe('Enabled state', () => {
    it('should not trigger shortcuts when disabled', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          enabled: false,
          onToolChange: mockOnToolChange,
        })
      );

      act(() => {
        simulateKeyDown('s');
      });

      expect(mockOnToolChange).not.toHaveBeenCalled();
    });

    it('should trigger shortcuts when enabled (default)', () => {
      renderHook(() =>
        useCanvasKeyboardShortcuts({
          onToolChange: mockOnToolChange,
        })
      );

      act(() => {
        simulateKeyDown('s');
      });

      expect(mockOnToolChange).toHaveBeenCalledWith('stamp');
    });
  });
});
