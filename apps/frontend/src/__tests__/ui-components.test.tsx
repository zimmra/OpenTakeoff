import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dialog, Popover } from '@/components/ui';

describe('UI Components', () => {
  describe('Dialog', () => {
    it('should render dialog with title and content', () => {
      render(
        <Dialog open={true} title="Test Dialog" description="Test description">
          <div>Dialog content</div>
        </Dialog>
      );

      expect(screen.getByText('Test Dialog')).toBeInTheDocument();
      expect(screen.getByText('Test description')).toBeInTheDocument();
      expect(screen.getByText('Dialog content')).toBeInTheDocument();
    });

    it('should render close button', () => {
      render(
        <Dialog open={true} title="Test Dialog">
          <div>Content</div>
        </Dialog>
      );

      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });
  });

  describe('Popover', () => {
    it('should render popover trigger', () => {
      render(
        <Popover trigger={<button>Open Popover</button>}>
          <div>Popover content</div>
        </Popover>
      );

      expect(screen.getByText('Open Popover')).toBeInTheDocument();
    });
  });
});
