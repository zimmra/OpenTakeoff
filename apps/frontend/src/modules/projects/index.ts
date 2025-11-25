/**
 * Projects Module
 * Exports all projects and plans functionality
 */

// Types
export type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  Plan,
  PlanMetadata,
  PlanUploadResponse,
  PaginatedProjectsResponse,
  PaginatedPlansResponse,
  PaginationParams,
} from './types';

// API Clients
export { projectsApi } from './api/projectsApi';
export { plansApi } from './api/plansApi';

// React Query Hooks
export {
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  projectKeys,
} from './hooks/useProjects';

export {
  usePlans,
  usePlan,
  useUploadPlan,
  useDeletePlan,
  planKeys,
} from './hooks/usePlans';

// Components
export { PlanThumbnail } from './components/PlanThumbnail';

// Pages
export { ProjectsListPage } from './pages/ProjectsListPage';
export { ProjectDetailPage } from './pages/ProjectDetailPage';
