/**
 * Color Picker Component
 * Accessible color picker using react-colorful with standard palette
 */

import { HexColorPicker } from 'react-colorful';
import namer from 'color-namer';
import { useMemo } from 'react';
import { Popover } from '@/components/ui/Popover';
import { STANDARD_PALETTE } from '@/utils/colors';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  error?: string;
}

export function ColorPicker({ value, onChange, label, error }: ColorPickerProps) {
  const displayColor = value || '#3B82F6'; // Default blue

  const colorName = useMemo(() => {
    if (!value) return 'No color selected';
    try {
      const names = namer(value);
      return names.ntc[0]?.name ?? value;
    } catch {
      return value;
    }
  }, [value]);

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}

      <Popover
        trigger={
          <button
            type="button"
            className={`flex items-center gap-3 px-4 py-2 border rounded-lg hover:bg-slate-50 transition-colors ${
              error ? 'border-red-300' : 'border-slate-300'
            }`}
            aria-label="Choose color"
          >
            <div
              className="w-8 h-8 rounded border border-slate-300 shadow-sm"
              style={{ backgroundColor: displayColor }}
              aria-hidden="true"
            />
            <span className="text-sm text-slate-700">
              {colorName}
            </span>
          </button>
        }
      >
        <div className="p-4 space-y-4 w-64">
          {/* Custom Picker */}
          <div className="flex flex-col gap-3">
            <HexColorPicker color={displayColor} onChange={onChange} style={{ width: '100%' }} />
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="#000000"
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              pattern="^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$"
            />
          </div>

          {/* Standard Palette */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Standard Colors</p>
            <div className="grid grid-cols-7 gap-2">
              {STANDARD_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onChange(color)}
                  className={`w-6 h-6 rounded-full border shadow-sm transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${
                    value.toLowerCase() === color.toLowerCase()
                      ? 'ring-2 ring-primary-500 ring-offset-1 border-transparent'
                      : 'border-slate-200'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>
      </Popover>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
