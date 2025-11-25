/**
 * Tests for KeyboardHelpPanel component
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { KeyboardHelpPanel } from '../KeyboardHelpPanel';

describe('KeyboardHelpPanel', () => {
  it('should not render when isOpen is false', () => {
    const { container } = render(<KeyboardHelpPanel isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render when isOpen is true', () => {
    render(<KeyboardHelpPanel isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('should display all shortcut categories', () => {
    render(<KeyboardHelpPanel isOpen={true} onClose={vi.fn()} />);

    // Check for category headings (they are uppercase and in h3 tags)
    expect(screen.getByRole('heading', { name: /zoom/i, level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /pan/i, level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /tools/i, level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /editing/i, level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /help/i, level: 3 })).toBeInTheDocument();
  });

  it('should display zoom shortcuts', () => {
    render(<KeyboardHelpPanel isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Zoom in')).toBeInTheDocument();
    expect(screen.getByText('Zoom out')).toBeInTheDocument();
    expect(screen.getByText('Fit to viewport')).toBeInTheDocument();
    expect(screen.getByText('Reset to 100%')).toBeInTheDocument();
  });

  it('should display pan shortcuts', () => {
    render(<KeyboardHelpPanel isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Pan up')).toBeInTheDocument();
    expect(screen.getByText('Pan down')).toBeInTheDocument();
    expect(screen.getByText('Pan left')).toBeInTheDocument();
    expect(screen.getByText('Pan right')).toBeInTheDocument();
    expect(screen.getByText('Fast pan')).toBeInTheDocument();
    expect(screen.getByText('Pan with mouse')).toBeInTheDocument();
  });

  it('should display tool selection shortcuts', () => {
    render(<KeyboardHelpPanel isOpen={true} onClose={vi.fn()} />);

    const selectPointerTexts = screen.getAllByText('Select / Pointer');
    expect(selectPointerTexts.length).toBeGreaterThan(0);
    expect(screen.getByText('Stamp tool')).toBeInTheDocument();
    expect(screen.getByText('Rectangle tool')).toBeInTheDocument();
    expect(screen.getByText('Line / Polygon tool')).toBeInTheDocument();
  });

  it('should display editing shortcuts', () => {
    render(<KeyboardHelpPanel isOpen={true} onClose={vi.fn()} />);

    const deleteTexts = screen.getAllByText('Delete selected');
    expect(deleteTexts.length).toBeGreaterThan(0);
    expect(screen.getByText('Undo (future)')).toBeInTheDocument();
    expect(screen.getByText('Redo (future)')).toBeInTheDocument();
  });

  it('should display help toggle shortcut', () => {
    render(<KeyboardHelpPanel isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Toggle this help panel')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<KeyboardHelpPanel isOpen={true} onClose={onClose} />);

    const closeButton = screen.getByLabelText('Close help panel');
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when overlay background is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<KeyboardHelpPanel isOpen={true} onClose={onClose} />);

    // Click the overlay background (the element with bg-black/50 class)
    const overlay = screen.getByText('Keyboard Shortcuts').closest('.fixed');
    if (overlay) {
      await user.click(overlay);
    }

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not call onClose when clicking inside the panel content', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<KeyboardHelpPanel isOpen={true} onClose={onClose} />);

    const heading = screen.getByText('Keyboard Shortcuts');
    await user.click(heading);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('should render keycaps with proper styling', () => {
    render(<KeyboardHelpPanel isOpen={true} onClose={vi.fn()} />);

    // Find keycap elements (kbd tags)
    const keycaps = screen.getAllByText('Ctrl');
    expect(keycaps.length).toBeGreaterThan(0);

    keycaps.forEach((keycap) => {
      expect(keycap.tagName).toBe('KBD');
    });
  });

  it('should display footer with help toggle hint', () => {
    render(<KeyboardHelpPanel isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/to toggle this help panel/i)).toBeInTheDocument();
  });
});
