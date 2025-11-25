/**
 * Plan Thumbnail Component
 * Renders a PDF thumbnail for plan cards with lazy loading
 */

import { useEffect, useState, useCallback } from 'react';

// Thumbnail scale for preview
const THUMBNAIL_SCALE = 0.3;

interface PlanThumbnailProps {
  /**
   * URL to the PDF file
   */
  fileUrl: string;

  /**
   * Alternative text for the thumbnail
   */
  alt?: string;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Page number to render (defaults to 1 - first page)
   */
  pageNumber?: number;
}

/**
 * PlanThumbnail Component
 * Lazily loads pdfjs-dist and renders the first page of a PDF as a thumbnail
 */
export function PlanThumbnail({ fileUrl, alt = 'Plan thumbnail', className = '', pageNumber = 1 }: PlanThumbnailProps) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate thumbnail from PDF
  const generateThumbnail = useCallback(async () => {
    if (!fileUrl) {
      setError('No file URL provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Dynamically import pdfjs-dist
      const pdfjs = await import('pdfjs-dist');

      // Set worker source
      const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;

      // Load the PDF document
      const loadingTask = pdfjs.getDocument(fileUrl);
      const pdf = await loadingTask.promise;

      // Get the specified page
      const page = await pdf.getPage(pageNumber);

      // Get the page's inherent rotation (0, 90, 180, or 270 degrees)
      const pageRotation = page.rotate;

      // Get viewport with explicit rotation to handle landscape/portrait correctly
      const viewport = page.getViewport({ scale: THUMBNAIL_SCALE, rotation: pageRotation });

      // Create off-screen canvas for thumbnail generation
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Failed to get canvas context');
      }

      // Render the page
      await page.render({
        canvasContext: context,
        viewport,
        // Fix for type mismatch in pdfjs-dist v5
        canvas: canvas,
      }).promise;

      // Convert canvas to data URL
      const dataUrl = canvas.toDataURL('image/png');
      setThumbnail(dataUrl);
      setLoading(false);
    } catch (err) {
      console.error('Error generating thumbnail:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate thumbnail');
      setLoading(false);
    }
  }, [fileUrl, pageNumber]);

  // Generate thumbnail on mount or when URL changes
  useEffect(() => {
    void generateThumbnail();
  }, [generateThumbnail]);

  // Loading state
  // Use a more neutral aspect ratio that works for both portrait and landscape
  if (loading) {
    return (
      <div className={`w-full min-h-[120px] flex items-center justify-center bg-gray-100 rounded ${className}`}>
        <div className="flex flex-col items-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <div className="text-gray-500 text-sm">Loading preview...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`w-full min-h-[120px] flex items-center justify-center bg-red-50 rounded ${className}`}>
        <div className="flex flex-col items-center space-y-2 px-4 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div className="text-red-600 text-xs">{error}</div>
        </div>
      </div>
    );
  }

  // Success state - show thumbnail
  return thumbnail ? (
    <img
      src={thumbnail}
      alt={alt}
      className={`w-full h-auto rounded ${className}`}
    />
  ) : null;
}
