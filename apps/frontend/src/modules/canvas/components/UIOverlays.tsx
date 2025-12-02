/**
 * UIOverlays Component
 *
 * Fixed-position overlay system that sits above the canvas/viewport stack.
 * Implements Excalidraw-style interface:
 * - Top Center: Toolbar (Tools)
 * - Top Left: Header (Menu/Title)
 * - Top Right: Right Panel (Properties/Library)
 * - Bottom Left: Zoom Controls AND Mini-map
 * - Left Center: Left Sidebar (Thumbnails)
 */

import type { ReactNode } from 'react';

export interface UIOverlaysProps {
  children: ReactNode;
  toolbar?: ReactNode; // Top Center
  header?: ReactNode; // Top Left
  zoomControls?: ReactNode; // Bottom Left
  leftSidebar?: ReactNode; // Left Center (floating)
  rightPanel?: ReactNode; // Right Center (floating)
  bottomRightControls?: ReactNode; // Bottom Right (anchored to right panel if present)
  miniMap?: ReactNode; // Bottom Left (adjoined to zoom)
  helpPanel?: ReactNode; // Modal
  className?: string;
}

/**
 * Z-index ladder
 */
const Z_INDEX = {
  CANVAS: 0,
  UI: 100,
  MODAL: 200,
} as const;

export function UIOverlays({
  children,
  toolbar,
  header,
  zoomControls,
  leftSidebar,
  rightPanel,
  bottomRightControls,
  miniMap,
  helpPanel,
  className = '',
}: UIOverlaysProps) {
  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Canvas Layer */}
      <div className="absolute inset-0" style={{ zIndex: Z_INDEX.CANVAS }}>
        {children}
      </div>

      {/* UI Layer - Pointer events disabled by default, enabled on children */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: Z_INDEX.UI }}>
        {/* Top Left: Header */}
        {header && <div className="absolute top-4 left-4 pointer-events-auto">{header}</div>}

        {/* Top Center: Toolbar */}
        {toolbar && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto">
            {toolbar}
          </div>
        )}

        {/* Bottom Left: Zoom Controls & MiniMap */}
        <div className="absolute bottom-4 left-4 pointer-events-auto flex items-end gap-2">
          {miniMap}
          {zoomControls}
        </div>

        {/* Left Sidebar: Floating vertical stack */}
        {leftSidebar && (
          <div
            className="absolute left-4 top-20 pointer-events-auto flex flex-col"
            style={{ maxWidth: '300px', maxHeight: 'calc(100% - 320px)' }}
          >
            {leftSidebar}
          </div>
        )}

        {/* Bottom Right: Snap Controls */}
        {bottomRightControls && (
          <div
            className="absolute bottom-4 pointer-events-auto transition-all duration-300 ease-in-out"
            style={{ right: rightPanel ? '392px' : '1rem' }}
          >
            {bottomRightControls}
          </div>
        )}

        {/* Right Panel: Floating vertical stack */}
        {rightPanel && (
          <div
            className="absolute right-4 top-4 bottom-4 pointer-events-auto"
            style={{ maxWidth: '360px' }}
          >
            {rightPanel}
          </div>
        )}

        {/* Modals */}
        {helpPanel && (
          <div className="absolute inset-0 pointer-events-auto" style={{ zIndex: Z_INDEX.MODAL }}>
            {helpPanel}
          </div>
        )}
      </div>
    </div>
  );
}
