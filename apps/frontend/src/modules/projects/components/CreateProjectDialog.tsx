/**
 * Create Project Dialog Component
 * Two-step form for project creation with name/description and optional PDF upload
 */

import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog } from '../../../components/ui/Dialog';

// Form validation schema
const projectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, description: string | undefined, pdfFile: File | null) => Promise<void>;
  isLoading: boolean;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: CreateProjectDialogProps) {
  const [step, setStep] = useState<'details' | 'upload'>('details');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProjectFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(projectSchema as any),
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      reset();
      setStep('details');
      setSelectedFile(null);
      setFileError(null);
    }
  }, [open, reset]);

  // Handle open/close
  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  // Handle form submission
  const handleFormSubmit = async (data: ProjectFormData) => {
    try {
      await onSubmit(data.name, data.description, selectedFile);
      handleOpenChange(false);
    } catch {
      // Error is logged in parent, just keep dialog open
    }
  };

  // Validate file
  const validateFile = (file: File): string | null => {
    if (file.type !== 'application/pdf') {
      return 'Only PDF files are allowed';
    }
    // 100MB limit
    if (file.size > 100 * 1024 * 1024) {
      return 'File size must be less than 100MB';
    }
    return null;
  };

  // Handle file selection
  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      setFileError(error);
      setSelectedFile(null);
    } else {
      setFileError(null);
      setSelectedFile(file);
    }
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Step 1: Project details
  const renderDetailsStep = () => (
    <form onSubmit={handleSubmit(() => setStep('upload'))} className="space-y-4">
      {/* Project Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
          Project Name <span className="text-danger-600">*</span>
        </label>
        <input
          {...register('name')}
          id="name"
          type="text"
          autoFocus
          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="e.g., Main Street Office Building"
        />
        {errors.name && (
          <p className="text-sm text-danger-600 mt-1">{errors.name.message}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">
          Description <span className="text-slate-500">(optional)</span>
        </label>
        <textarea
          {...register('description')}
          id="description"
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          placeholder="Brief description of the project..."
        />
        {errors.description && (
          <p className="text-sm text-danger-600 mt-1">{errors.description.message}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => handleOpenChange(false)}
          className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={isLoading}>
          Next: Upload PDF
        </button>
      </div>
    </form>
  );

  // Step 2: PDF upload
  const renderUploadStep = () => (
    <div className="space-y-4">
      {/* File drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
          ${
            isDragging
              ? 'border-primary-500 bg-primary-50'
              : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50'
          }
          ${fileError ? 'border-danger-300 bg-danger-50' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {selectedFile ? (
          <div className="space-y-2">
            <svg
              className="w-12 h-12 mx-auto text-success-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm font-medium text-slate-900">{selectedFile.name}</p>
            <p className="text-xs text-slate-500">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
                setFileError(null);
              }}
              className="text-sm text-primary-600 hover:text-primary-700 underline"
            >
              Remove file
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <svg
              className="w-12 h-12 mx-auto text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm font-medium text-slate-700">
              Drop your PDF here or click to browse
            </p>
            <p className="text-xs text-slate-500">PDF files up to 100MB</p>
          </div>
        )}
      </div>

      {fileError && (
        <p className="text-sm text-danger-600 text-center">{fileError}</p>
      )}

      <p className="text-xs text-slate-500 text-center">
        You can upload a floorplan now or add it later
      </p>

      {/* Actions */}
      <div className="flex justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => setStep('details')}
          className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          disabled={isLoading}
        >
          Back
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSubmit(handleFormSubmit)}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            disabled={isLoading}
          >
            Skip Upload
          </button>
          <button
            type="button"
            onClick={handleSubmit(handleFormSubmit)}
            className="btn-primary"
            disabled={isLoading || !selectedFile}
          >
            {isLoading ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={step === 'details' ? 'Create New Project' : 'Upload PDF Plan'}
      description={
        step === 'details'
          ? 'Enter project details to get started'
          : 'Add a floorplan PDF to your project (optional)'
      }
    >
      {step === 'details' ? renderDetailsStep() : renderUploadStep()}
    </Dialog>
  );
}
