/**
 * Type definitions for PDF module
 */

import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { PageMetadata } from '../canvas/stores/useViewportStore';

export interface PdfDocumentState {
  /** The loaded PDF document */
  document: PDFDocumentProxy | null;
  /** Total number of pages */
  totalPages: number;
  /** Current active page number (1-indexed) */
  currentPage: number;
  /** Current zoom scale */
  scale: number;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Page metadata for multi-page support */
  pageMetadata: PageMetadata[];
  /** Current page being rendered (for render queue) */
  pageRendering: number | null;
  /** Pending page to render next (for render queue) */
  pageNumPending: number | null;
}

export interface PdfDocumentActions {
  /** Load a PDF from URL */
  loadPdf: (url: string) => Promise<void>;
  /** Navigate to a specific page */
  goToPage: (page: number) => void;
  /** Jump to page with camera pan */
  jumpToPage: (page: number) => void;
  /** Set zoom scale */
  setScale: (scale: number) => void;
  /** Zoom in */
  zoomIn: () => void;
  /** Zoom out */
  zoomOut: () => void;
  /** Navigate to next page */
  nextPage: () => void;
  /** Navigate to previous page */
  previousPage: () => void;
  /** Queue a page render to prevent overlaps */
  queueRenderPage: (pageNumber: number) => void;
  /** Mark current page render as complete */
  completeRenderPage: () => void;
  /** Update current page based on camera position */
  updateCurrentPageFromCamera: (cameraY: number, viewportHeight: number) => void;
}

export interface PdfCanvasProps {
  /** CSS class name */
  className?: string;
}

export interface PdfThumbnailSidebarProps {
  /** Thumbnail URLs or page numbers */
  thumbnails?: string[];
  /** Callback when thumbnail is clicked */
  onThumbnailClick?: (pageNumber: number) => void;
  /** CSS class name */
  className?: string;
}

export interface PdfViewerProps {
  /** URL of the PDF to load */
  pdfUrl: string;
  /** Initial page number */
  initialPage?: number;
  /** Initial scale */
  initialScale?: number;
  /** CSS class name */
  className?: string;
}

export type { PDFDocumentProxy, PDFPageProxy };
