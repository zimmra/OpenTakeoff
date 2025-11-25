/**
 * Stamps Module
 * Interactive stamp placement and editing on PDF plans
 */

export { StampCanvas } from './components/StampCanvas';
export type { StampCanvasProps } from './components/StampCanvas';

export { StampShape } from './components/StampShape';
export type { StampShapeProps } from './components/StampShape';

export { StampMetadataModal } from './components/StampMetadataModal';
export type { StampMetadataModalProps } from './components/StampMetadataModal';

export { StampToolbar } from './components/StampToolbar';
export type { StampToolbarProps } from './components/StampToolbar';

export {
  useStampStore,
  useStamps,
  useStamp,
  useSelectedStamp,
  useStampsForPlan,
} from './state/useStampStore';

export {
  useCreateStampMutation,
  useUpdateStampMutation,
  useDeleteStampMutation,
  stampKeys,
} from './hooks/useStampMutations';

export { stampsApi } from './api/stampsApi';
export type { CreateStampRequest, UpdateStampRequest, ListStampsParams, ListStampsResponse } from './api/stampsApi';

export * from './types';
export * from './utils/coordinates';
