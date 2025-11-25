/**
 * Stamp Palette Sidebar
 * Device selection interface with keyboard shortcuts (1-9)
 */

import { useEffect } from 'react';
import Icon from '@mdi/react';
import { mdiPackageVariant } from '@mdi/js';
import { DeviceIcon } from './DeviceIcon';
import type { Device } from '../types';

interface StampPaletteProps {
  devices: Device[];
  selectedDeviceId: string | null;
  onDeviceSelect: (device: Device) => void;
  deviceCounts?: Record<string, number>; // Optional count per device
  isLoading?: boolean;
}

export function StampPalette({
  devices,
  selectedDeviceId,
  onDeviceSelect,
  deviceCounts = {},
  isLoading = false,
}: StampPaletteProps) {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Check if user is typing in an input or textarea
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = event.key;
      const keyNum = parseInt(key, 10);

      // Handle keys 1-9
      if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= 9) {
        const deviceIndex = keyNum - 1;
        const device = devices[deviceIndex];
        if (device) {
          event.preventDefault();
          onDeviceSelect(device);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [devices, onDeviceSelect]);


  if (isLoading) {
    return (
      <div className="w-80 glass-card p-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          <span className="text-sm text-slate-600">Loading devices...</span>
        </div>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="w-80 glass-card p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Icon path={mdiPackageVariant} size={2} className="text-slate-300" />
          <h3 className="font-semibold text-slate-900">No Devices</h3>
          <p className="text-sm text-slate-600">
            Create devices in the catalog to use them as stamps
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 glass-card p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Stamp Palette</h3>
        <span className="text-xs text-slate-500">Press 1-9 to select</span>
      </div>

      {/* Device chips */}
      <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
        {devices.slice(0, 9).map((device, index) => {
          const isActive = device.id === selectedDeviceId;
          const count = deviceCounts[device.id] ?? 0;
          const shortcut = index + 1;

          return (
            <button
              key={device.id}
              onClick={() => onDeviceSelect(device)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                border-2 ${
                  isActive
                    ? 'border-primary-500 bg-primary-50 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }
              `}
              aria-label={`Select ${device.name} (Shortcut: ${shortcut})`}
              aria-pressed={isActive}
            >
              {/* Keyboard shortcut badge */}
              <div
                className={`
                  flex items-center justify-center w-6 h-6 rounded text-xs font-bold
                  ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }
                `}
              >
                {shortcut}
              </div>

              {/* Color indicator */}
              {device.color && (
                <div
                  className="w-8 h-8 rounded border-2 border-white shadow-sm flex items-center justify-center text-white"
                  style={{ backgroundColor: device.color }}
                  aria-label={`Color: ${device.color}`}
                >
                  <DeviceIcon iconKey={device.iconKey} size={20} color="currentColor" />
                </div>
              )}
              {!device.color && (
                <div className="w-8 h-8 rounded border-2 border-slate-300 flex items-center justify-center bg-white text-slate-600">
                  <DeviceIcon iconKey={device.iconKey} size={20} color="currentColor" />
                </div>
              )}

              {/* Device info */}
              <div className="flex-1 text-left min-w-0">
                <div className="font-medium text-slate-900 truncate">{device.name}</div>
                {device.description && (
                  <div className="text-xs text-slate-500 truncate">{device.description}</div>
                )}
              </div>

              {/* Count badge */}
              {count > 0 && (
                <div
                  className={`
                    flex items-center justify-center min-w-[2rem] h-6 px-2 rounded-full text-xs font-bold
                    ${
                      isActive
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }
                  `}
                  aria-label={`Count: ${count}`}
                >
                  {count}
                </div>
              )}
            </button>
          );
        })}

        {devices.length > 9 && (
          <div className="pt-2 text-xs text-slate-500 text-center">
            + {devices.length - 9} more devices (scroll to view)
          </div>
        )}
      </div>

      {/* Footer hint */}
      {selectedDeviceId && (
        <div className="pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-600 text-center">
            Selected device ready • Click to place stamp
          </p>
        </div>
      )}
    </div>
  );
}
