/**
 * Device Catalog Table
 * Sortable, filterable table using TanStack Table
 */

import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import Icon from '@mdi/react';
import { 
  mdiEye, 
  mdiEyeOff, 
  mdiMagnify, 
  mdiChevronUp, 
  mdiChevronDown, 
  mdiDotsHorizontal 
} from '@mdi/js';
import { DeviceIcon } from './DeviceIcon';
import type { Device } from '../types';

import { useDeviceVisibilityStore } from '../state/useDeviceVisibilityStore';

interface DeviceCatalogTableProps {
  devices: Device[];
  isLoading?: boolean;
  onEdit?: (device: Device) => void;
  onDelete?: (device: Device) => void;
}

const VisibilityCell = ({ deviceId }: { deviceId: string }) => {
  const isVisible = useDeviceVisibilityStore((state) => !state.hiddenDeviceIds.has(deviceId));
  const toggleVisibility = useDeviceVisibilityStore((state) => state.toggleVisibility);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleVisibility(deviceId);
      }}
      className="p-1 text-slate-500 hover:text-slate-700 transition-colors rounded hover:bg-slate-100"
      title={isVisible ? 'Hide device' : 'Show device'}
      aria-label={isVisible ? 'Hide device' : 'Show device'}
    >
      {isVisible ? (
        <Icon path={mdiEye} size={0.8} />
      ) : (
        <Icon path={mdiEyeOff} size={0.8} className="text-slate-400" />
      )}
    </button>
  );
};

interface RowProps {
  row: {
    id: string;
    original: { id: string };
  };
  children: React.ReactNode;
}

const RowWithVisibility = ({ row, children }: RowProps) => {
  const isHidden = useDeviceVisibilityStore((state) => state.hiddenDeviceIds.has(row.original.id));

  return (
    <tr
      key={row.id}
      className={`hover:bg-slate-50/50 transition-colors ${isHidden ? 'opacity-50' : ''}`}
    >
      {children}
    </tr>
  );
};

export function DeviceCatalogTable({
  devices,
  isLoading = false,
  onEdit,
  onDelete,
}: DeviceCatalogTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo<ColumnDef<Device>[]>(
    () => [
      {
        id: 'visibility',
        header: '',
        size: 40,
        cell: (info) => <VisibilityCell deviceId={info.row.original.id} />,
      },
      {
        accessorKey: 'name',
        header: 'Name',
        cell: (info) => (
          <div className="flex items-center gap-2">
            {info.row.original.color && (
              <div
                className="w-4 h-4 rounded border border-slate-300"
                style={{ backgroundColor: info.row.original.color }}
                aria-label={`Color: ${info.row.original.color}`}
              />
            )}
            <span className="font-medium text-slate-900">{info.getValue() as string}</span>
          </div>
        ),
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: (info) => (
          <span className="text-slate-600 text-sm">
            {(info.getValue() as string | null) ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'iconKey',
        header: 'Icon',
        cell: (info) => {
          const iconKey = info.getValue() as string | null;
          if (!iconKey) return <span className="text-slate-400">—</span>;

          return (
            <div className="text-slate-600">
              <DeviceIcon iconKey={iconKey} size={20} />
            </div>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: (info) => (
          <span className="text-slate-500 text-sm">
            {new Date(info.getValue() as string).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: (info) => (
          <div className="flex justify-end gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(info.row.original)}
                className="px-3 py-1 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded transition-colors"
                aria-label={`Edit ${info.row.original.name}`}
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(info.row.original)}
                className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                aria-label={`Delete ${info.row.original.name}`}
              >
                Delete
              </button>
            )}
          </div>
        ),
      },
    ],
    [onEdit, onDelete],
  );

  const table = useReactTable({
    data: devices,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (isLoading) {
    return (
      <div className="glass-card p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          <span className="ml-3 text-slate-600">Loading devices...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="glass-card p-4">
          <div className="relative">
          <Icon path={mdiMagnify} size={0.8} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search devices..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white/50"
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-slate-200 bg-slate-50/50">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider"
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={
                            header.column.getCanSort()
                              ? 'flex items-center gap-2 cursor-pointer select-none hover:text-slate-900'
                              : ''
                          }
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <span className="inline-flex">
                              {header.column.getIsSorted() === 'asc' ? (
                                <Icon path={mdiChevronUp} size={0.6} />
                              ) : header.column.getIsSorted() === 'desc' ? (
                                <Icon path={mdiChevronDown} size={0.6} />
                              ) : (
                                <Icon path={mdiChevronDown} size={0.6} className="opacity-30" />
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white/30 divide-y divide-slate-200">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Icon path={mdiDotsHorizontal} size={1.2} className="text-slate-400" />
                      <p className="text-slate-600">
                        {globalFilter ? 'No devices match your search' : 'No devices yet'}
                      </p>
                      {!globalFilter && (
                        <p className="text-sm text-slate-500">
                          Create your first device to get started
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <RowWithVisibility key={row.id} row={row}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </RowWithVisibility>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer with count */}
      {devices.length > 0 && (
        <div className="flex justify-between items-center px-2 text-sm text-slate-600">
          <span>
            Showing {table.getRowModel().rows.length} of {devices.length} device
            {devices.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
