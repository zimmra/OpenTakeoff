/**
 * Devices Module
 * Export all device-related functionality
 */

// Types
export type * from './types';

// API
export { devicesApi } from './api/devicesApi';

// Hooks
export {
  useDevices,
  useDevice,
  useCreateDevice,
  useUpdateDevice,
  useDeleteDevice,
  deviceKeys,
} from './hooks/useDevices';

// Components
export { DeviceCatalog } from './components/DeviceCatalog';
export { DeviceCatalogTable } from './components/DeviceCatalogTable';
export { DeviceFormModal } from './components/DeviceFormModal';
export { ColorPicker } from './components/ColorPicker';
export { IconPicker } from './components/IconPicker';
export { StampPalette } from './components/StampPalette';
