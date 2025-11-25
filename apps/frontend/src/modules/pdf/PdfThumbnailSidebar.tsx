/**
 * PDF Thumbnail Sidebar Component
 * Displays page thumbnails with lazy loading and navigation
 * Floating sidebar style
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { usePdfDocument } from './PdfDocumentProvider';
import type { PdfThumbnailSidebarProps } from './types';

// Thumbnail scale for smaller preview
const THUMBNAIL_SCALE = 0.25;

type ThumbnailState = Record<number, string | null>;

export function PdfThumbnailSidebar({ className = '', onThumbnailClick }: PdfThumbnailSidebarProps) {
  const { document, currentPage, goToPage } = usePdfDocument();
  const [thumbnails, setThumbnails] = useState<ThumbnailState>({});
  const observerRef = useRef<IntersectionObserver | null>(null);
  const thumbnailRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [isExpanded, setIsExpanded] = useState(true);

  // Generate thumbnail for a specific page
  const generateThumbnail = useCallback(
    async (pageNumber: number): Promise<string | null> => {
      if (!document) return null;

      try {
        const page = await document.getPage(pageNumber);
        const pageRotation = page.rotate;
        const viewport = page.getViewport({ scale: THUMBNAIL_SCALE, rotation: pageRotation });

        const canvas = window.document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const context = canvas.getContext('2d');
        if (!context) return null;

        await page.render({
          canvasContext: context,
          viewport,
          // Fix for type mismatch in pdfjs-dist v5
          canvas: canvas,
        }).promise;

        return canvas.toDataURL('image/png');
      } catch (error) {
        console.error(`Error generating thumbnail for page ${pageNumber}:`, error);
        return null;
      }
    },
    [document]
  );

  // Set up IntersectionObserver
  useEffect(() => {
    if (!document) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNumber = parseInt(entry.target.getAttribute('data-page') ?? '0', 10);
            if (pageNumber && !thumbnails[pageNumber]) {
              void generateThumbnail(pageNumber).then((dataUrl) => {
                if (dataUrl) {
                  setThumbnails((prev) => ({ ...prev, [pageNumber]: dataUrl }));
                }
              });
            }
          }
        });
      },
      { root: null, rootMargin: '50px', threshold: 0.1 }
    );

    thumbnailRefs.current.forEach((element) => {
      if (observerRef.current) observerRef.current.observe(element);
    });

    return () => observerRef.current?.disconnect();
  }, [document, generateThumbnail, thumbnails]);

  const handleThumbnailClick = (pageNumber: number) => {
    goToPage(pageNumber);
    onThumbnailClick?.(pageNumber);
  };

  if (!document) return null;

  const pages = Array.from({ length: document.numPages }, (_, i) => i + 1);

  return (
    <div
      className={`
        flex flex-col bg-white/90 backdrop-blur-md border border-slate-200 shadow-lg rounded-lg transition-all duration-300 overflow-hidden
        ${isExpanded ? 'w-48 h-auto max-h-full' : 'w-12 h-12'}
        ${className}
      `}
    >
      {/* Header / Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-3 bg-slate-50 border-b border-slate-200 hover:bg-slate-100 transition-colors"
      >
        {isExpanded ? (
          <>
            <span className="text-sm font-semibold text-slate-700">Pages</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
          {pages.map((pageNumber) => {
            const isActive = pageNumber === currentPage;
            const thumbnailData = thumbnails[pageNumber];

            return (
              <div
                key={pageNumber}
                ref={(el) => {
                  if (el) thumbnailRefs.current.set(pageNumber, el);
                  else thumbnailRefs.current.delete(pageNumber);
                }}
                data-page={pageNumber}
                onClick={() => handleThumbnailClick(pageNumber)}
                className={`
                  cursor-pointer rounded-md overflow-hidden transition-all
                  ${isActive ? 'ring-2 ring-blue-500 ring-offset-2 shadow-md' : 'hover:ring-2 hover:ring-slate-300 hover:shadow-sm'}
                `}
              >
                <div className="relative bg-white min-h-[80px]">
                  {thumbnailData ? (
                    <img src={thumbnailData} alt={`Page ${pageNumber}`} className="w-full h-auto block" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                  )}
                  <div className={`
                    absolute bottom-0 left-0 right-0 text-center text-[10px] py-0.5 font-medium
                    ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-800/80 text-white'}
                  `}>
                    Page {pageNumber}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
