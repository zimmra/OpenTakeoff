/**
 * Tests for CreateProjectDialog
 */

/* eslint-disable @typescript-eslint/non-nullable-type-assertion-style */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { CreateProjectDialog } from '../CreateProjectDialog';

describe('CreateProjectDialog', () => {
  const mockOnSubmit = vi.fn();
  const mockOnOpenChange = vi.fn();

  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
    onSubmit: mockOnSubmit,
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Step 1: Project Details', () => {
    it('should render project name and description fields', () => {
      render(<CreateProjectDialog {...defaultProps} />);

      expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByText('Next: Upload PDF')).toBeInTheDocument();
    });

    it('should show validation error for empty project name', async () => {
      const user = userEvent.setup();
      render(<CreateProjectDialog {...defaultProps} />);

      const nextButton = screen.getByText('Next: Upload PDF');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/project name is required/i)).toBeInTheDocument();
      });
    });

    it('should show validation error for project name over 100 characters', async () => {
      const user = userEvent.setup();
      render(<CreateProjectDialog {...defaultProps} />);

      const nameInput = screen.getByLabelText(/project name/i);
      const longName = 'a'.repeat(101);
      await user.type(nameInput, longName);

      const nextButton = screen.getByText('Next: Upload PDF');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/must be less than 100 characters/i)).toBeInTheDocument();
      });
    });

    it('should show validation error for description over 500 characters', async () => {
      const user = userEvent.setup();
      render(<CreateProjectDialog {...defaultProps} />);

      const nameInput = screen.getByLabelText(/project name/i);
      await user.type(nameInput, 'Test Project');

      const descInput = screen.getByLabelText(/description/i);
      const longDesc = 'a'.repeat(501);
      // Use paste instead of type for long strings to avoid timeout
      await user.click(descInput);
      await user.paste(longDesc);

      const nextButton = screen.getByText('Next: Upload PDF');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/must be less than 500 characters/i)).toBeInTheDocument();
      });
    });

    it('should progress to upload step with valid inputs', async () => {
      const user = userEvent.setup();
      render(<CreateProjectDialog {...defaultProps} />);

      const nameInput = screen.getByLabelText(/project name/i);
      await user.type(nameInput, 'Test Project');

      const nextButton = screen.getByText('Next: Upload PDF');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Upload PDF Plan')).toBeInTheDocument();
        expect(screen.getByText(/Drop your PDF here or click to browse/i)).toBeInTheDocument();
      });
    });

    it('should allow cancel from details step', async () => {
      const user = userEvent.setup();
      render(<CreateProjectDialog {...defaultProps} />);

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Step 2: PDF Upload', () => {
    let user: ReturnType<typeof userEvent.setup>;

    beforeEach(async () => {
      user = userEvent.setup();
      render(<CreateProjectDialog {...defaultProps} />);

      const nameInput = screen.getByLabelText(/project name/i) as HTMLInputElement;
      await user.clear(nameInput);
      await user.type(nameInput, 'Test Project');

      const nextButton = screen.getByText('Next: Upload PDF');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Upload PDF Plan')).toBeInTheDocument();
      });
    });

    it('should render upload drop zone', () => {
      expect(screen.getByText(/Drop your PDF here or click to browse/i)).toBeInTheDocument();
      expect(screen.getByText(/PDF files up to 100MB/i)).toBeInTheDocument();
    });

    it('should show error for non-PDF files', async () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const container = screen.getByText(/Drop your PDF here/i).closest('div');
      const input = container?.querySelector('input[type="file"]') as HTMLInputElement;

      if (input) {
        await user.upload(input, file);
        await waitFor(() => {
          expect(screen.getByText(/Only PDF files are allowed/i)).toBeInTheDocument();
        });
      }
    });

    it('should show error for files over 100MB', async () => {
      // Create a file mock that reports size over 100MB
      const largeFile = new File(['content'], 'large.pdf', { type: 'application/pdf' });
      Object.defineProperty(largeFile, 'size', { value: 101 * 1024 * 1024 });

      const container = screen.getByText(/Drop your PDF here/i).closest('div');
      const input = container?.querySelector('input[type="file"]') as HTMLInputElement;

      if (input) {
        await user.upload(input, largeFile);
        await waitFor(() => {
          expect(screen.getByText(/File size must be less than 100MB/i)).toBeInTheDocument();
        });
      }
    });

    it('should accept valid PDF file', async () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      const container = screen.getByText(/Drop your PDF here/i).closest('div');
      const input = container?.querySelector('input[type="file"]') as HTMLInputElement;

      if (input) {
        await user.upload(input, file);
        await waitFor(() => {
          expect(screen.getByText('test.pdf')).toBeInTheDocument();
        });
      }
    });

    it('should allow removing selected file', async () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      const container = screen.getByText(/Drop your PDF here/i).closest('div');
      const input = container?.querySelector('input[type="file"]') as HTMLInputElement;

      if (input) {
        await user.upload(input, file);

        await waitFor(() => {
          expect(screen.getByText('test.pdf')).toBeInTheDocument();
        });

        const removeButton = screen.getByText('Remove file');
        await user.click(removeButton);

        await waitFor(() => {
          expect(screen.queryByText('test.pdf')).not.toBeInTheDocument();
          expect(screen.getByText(/Drop your PDF here/i)).toBeInTheDocument();
        });
      }
    });

    it('should allow going back to details step', async () => {
      const user = userEvent.setup();

      const backButton = screen.getByText('Back');
      await user.click(backButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Project')).toBeInTheDocument();
        expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
      });
    });

    it('should allow skipping upload', async () => {
      mockOnSubmit.mockResolvedValue(undefined);

      const skipButton = screen.getByText('Skip Upload');
      await user.click(skipButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith('Test Project', '', null);
      });
    });

    it('should submit with PDF when create button is clicked', async () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      mockOnSubmit.mockResolvedValue(undefined);

      const container = screen.getByText(/Drop your PDF here/i).closest('div');
      const input = container?.querySelector('input[type="file"]') as HTMLInputElement;

      if (input) {
        await user.upload(input, file);

        await waitFor(() => {
          expect(screen.getByText('test.pdf')).toBeInTheDocument();
        });

        const createButton = screen.getByText('Create Project');
        await user.click(createButton);

        await waitFor(() => {
          expect(mockOnSubmit).toHaveBeenCalledWith('Test Project', '', file);
        });
      }
    });

    it('should disable create button when no file is selected', () => {
      const createButton = screen.getByText('Create Project');
      expect(createButton).toBeDisabled();
    });
  });

  describe('Reset on Close', () => {
    it('should reset form when dialog is closed', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<CreateProjectDialog {...defaultProps} />);

      const nameInput = screen.getByLabelText(/project name/i);
      await user.type(nameInput, 'Test Project');

      // Close dialog
      rerender(<CreateProjectDialog {...defaultProps} open={false} />);

      // Wait for close animation to complete
      await waitFor(() => {
        expect(screen.queryByText('Create New Project')).not.toBeInTheDocument();
      });

      // Reopen dialog
      rerender(<CreateProjectDialog {...defaultProps} open={true} />);

      // Wait for dialog to open
      await waitFor(() => {
        expect(screen.getByText('Create New Project')).toBeInTheDocument();
      });

      // Form should be reset
      const newNameInput = screen.getByLabelText(/project name/i);
      expect(newNameInput).toHaveValue('');
    });
  });
});
