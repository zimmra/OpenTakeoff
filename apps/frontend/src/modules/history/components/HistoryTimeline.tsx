/**
 * History Timeline Component
 * Displays chronological list of undo/redo history entries
 */

import Icon from '@mdi/react';
import { mdiHistory, mdiRecordCircleOutline, mdiCloseCircleOutline, mdiPencil } from '@mdi/js';
import { useHistoryStore, useCanUndo } from '../state/useHistoryStore';
import { useUndoMutation } from '../hooks/useHistoryMutations';
import type { HistoryEntry } from '../types';

interface HistoryTimelineProps {
  projectId: string | undefined;
}

/**
 * Format timestamp as relative time (e.g., "2 minutes ago")
 */
function formatRelativeTime(timestamp: string): string {
  const now = new Date().getTime();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

/**
 * Get icon for history entry type
 */
function getEntryIcon(entry: HistoryEntry) {
  switch (entry.type) {
    case 'create':
      return <Icon path={mdiRecordCircleOutline} size={0.7} className="text-green-500" />;
    case 'update':
      return <Icon path={mdiPencil} size={0.7} className="text-blue-500" />;
    case 'delete':
      return <Icon path={mdiCloseCircleOutline} size={0.7} className="text-red-500" />;
    default:
      return <Icon path={mdiRecordCircleOutline} size={0.7} className="text-slate-400" />;
  }
}

/**
 * Get descriptive text for history entry
 */
function getEntryDescription(entry: HistoryEntry): string {
  const entityLabel = entry.entityType === 'stamp' ? 'Stamp' : 'Location';

  switch (entry.type) {
    case 'create':
      return `${entityLabel} created`;
    case 'update':
      return `${entityLabel} updated`;
    case 'delete':
      return `${entityLabel} deleted`;
    default:
      return `${entityLabel} changed`;
  }
}

export function HistoryTimeline({ projectId }: HistoryTimelineProps) {
  const entries = useHistoryStore((state) => state.entries);
  const isUndoing = useHistoryStore((state) => state.isUndoing);
  const isLoading = useHistoryStore((state) => state.isLoading);
  const error = useHistoryStore((state) => state.error);
  const canUndo = useCanUndo();

  const undoMutation = useUndoMutation(projectId ?? '');

  const handleUndo = () => {
    if (projectId && canUndo && !undoMutation.isPending && !isUndoing) {
      undoMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="w-80 glass-card p-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          <span className="text-sm text-slate-600">Loading history...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-80 glass-card p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Icon path={mdiCloseCircleOutline} size={2} className="text-red-300" />
          <h3 className="font-semibold text-red-900">Error</h3>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="w-80 glass-card p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Icon path={mdiHistory} size={2} className="text-slate-300" />
          <h3 className="font-semibold text-slate-900">No History</h3>
          <p className="text-sm text-slate-600">
            Actions will appear here. Press Ctrl/Cmd+Z to undo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 glass-card p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon path={mdiHistory} size={0.8} className="text-slate-700" />
          <h3 className="text-lg font-semibold text-slate-900">History</h3>
        </div>
        <span className="text-xs text-slate-500 px-2 py-1 bg-slate-100 rounded">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {/* Undo button */}
      {canUndo && (
        <button
          onClick={handleUndo}
          disabled={isUndoing || undoMutation.isPending}
          className="w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300
                     text-white rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-2"
        >
          {isUndoing || undoMutation.isPending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Undoing...
            </>
          ) : (
            <>
              <Icon path={mdiHistory} size={0.7} />
              Undo Last Action (Ctrl+Z)
            </>
          )}
        </button>
      )}

      {/* Timeline entries */}
      <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
        {entries.map((entry, index) => (
          <div
            key={entry.id}
            className={`
              flex items-start gap-3 p-3 rounded-lg border transition-colors
              ${index === 0 ? 'border-primary-300 bg-primary-50' : 'border-slate-200 bg-white hover:bg-slate-50'}
            `}
          >
            {/* Icon */}
            <div className="mt-0.5">{getEntryIcon(entry)}</div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {getEntryDescription(entry)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {formatRelativeTime(entry.createdAt)}
              </p>
            </div>

            {/* Badge for latest entry */}
            {index === 0 && (
              <span className="text-xs text-primary-700 font-medium px-2 py-0.5 bg-primary-100 rounded">
                Latest
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div className="pt-2 border-t border-slate-200">
        <p className="text-xs text-slate-500 text-center">
          Max 100 entries • Press Ctrl/Cmd+Z to undo
        </p>
      </div>
    </div>
  );
}
