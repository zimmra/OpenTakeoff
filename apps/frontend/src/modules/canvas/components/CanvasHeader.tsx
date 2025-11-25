/**
 * CanvasHeader Component
 *
 * Top-left floating header containing navigation and plan info.
 * Replaces the traditional breadcrumb bar.
 */

import { Link } from 'react-router-dom';

export interface CanvasHeaderProps {
  projectId: string;
  projectName: string;
  planName: string;
  className?: string;
  onSettingsClick?: () => void;
}

export function CanvasHeader({ projectId, projectName, planName, className = '', onSettingsClick }: CanvasHeaderProps) {
  return (
    <div className={`flex items-center gap-3 p-2 bg-white/90 backdrop-blur-md border border-slate-200 rounded-lg shadow-lg ${className}`}>
      {/* Menu / Back Button */}
      <Link
        to={`/projects/${projectId}`}
        className="p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
        title="Back to Project"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </Link>

      <div className="h-6 w-px bg-slate-200"></div>

      {/* Plan Info */}
      <div className="flex flex-col">
        <div className="text-xs text-slate-500 font-medium leading-none mb-1">{projectName}</div>
        <div className="text-sm text-slate-900 font-semibold leading-none">{planName}</div>
      </div>

      {onSettingsClick && (
        <>
          <div className="h-6 w-px bg-slate-200"></div>
          <button
            onClick={onSettingsClick}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

