import { Dialog } from '../../../components/ui/Dialog';
import { useStampStore } from '../../stamps/state/useStampStore';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const deviceIconRadius = useStampStore((state) => state.deviceIconRadius);
  const setDeviceIconRadius = useStampStore((state) => state.setDeviceIconRadius);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Settings"
      description="Adjust global preferences."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">
              Device Icon Radius
            </label>
            <span className="text-sm text-slate-500 font-mono">
              {deviceIconRadius}px
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={40}
            value={deviceIconRadius}
            onChange={(e) => setDeviceIconRadius(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
          <p className="text-xs text-slate-500">
            Controls the size of device icons on the canvas.
          </p>
        </div>
      </div>
    </Dialog>
  );
}

