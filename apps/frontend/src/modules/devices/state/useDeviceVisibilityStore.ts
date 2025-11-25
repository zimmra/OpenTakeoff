import { create } from 'zustand';

interface DeviceVisibilityState {
  hiddenDeviceIds: Set<string>;
  toggleVisibility: (deviceId: string) => void;
  showAll: () => void;
  hideAll: (deviceIds: string[]) => void;
  isDeviceVisible: (deviceId: string) => boolean;
}

export const useDeviceVisibilityStore = create<DeviceVisibilityState>((set, get) => ({
  hiddenDeviceIds: new Set(),
  toggleVisibility: (deviceId: string) => {
    set((state) => {
      const newHidden = new Set(state.hiddenDeviceIds);
      if (newHidden.has(deviceId)) {
        newHidden.delete(deviceId);
      } else {
        newHidden.add(deviceId);
      }
      return { hiddenDeviceIds: newHidden };
    });
  },
  showAll: () => set({ hiddenDeviceIds: new Set() }),
  hideAll: (deviceIds: string[]) => set({ hiddenDeviceIds: new Set(deviceIds) }),
  isDeviceVisible: (deviceId: string) => !get().hiddenDeviceIds.has(deviceId),
}));

