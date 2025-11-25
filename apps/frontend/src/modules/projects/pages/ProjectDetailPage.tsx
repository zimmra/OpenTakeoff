/**
 * Project Detail Page
 * Displays project metadata, plan gallery, and management actions
 */

import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useProject } from '../hooks/useProjects';
import { usePlans, useUploadPlan, useDeletePlan } from '../hooks/usePlans';
import { useDeleteProject } from '../hooks/useProjects';
import { PlanThumbnail } from '../components/PlanThumbnail';
import { Dialog } from '../../../components/ui/Dialog';
import { ExportDialog } from '../../exports/components/ExportDialog';
import type { Plan } from '../types';

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

/**
 * Format date in a localized format
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * ProjectDetailPage Component
 */
export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // Data hooks - always call hooks at top level
  const projectQuery = useProject(projectId ?? '');
  const plansQuery = usePlans(projectId ?? '');

  // Mutation hooks
  const uploadPlan = useUploadPlan(projectId ?? '');
  const deletePlan = useDeletePlan(projectId ?? '');
  const deleteProject = useDeleteProject();

  // UI state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false);
  const [deletePlanDialogOpen, setDeletePlanDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Guard against missing projectId after hooks
  if (!projectId) {
    return (
      <div className="glass-card p-6 bg-red-50 border-red-200">
        <div className="flex items-center space-x-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-red-900">Invalid Project ID</h3>
            <p className="text-red-700">No project ID provided in the URL.</p>
          </div>
        </div>
      </div>
    );
  }

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    try {
      setUploadError(null);
      await uploadPlan.mutateAsync(file);
      setUploadDialogOpen(false);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to upload file');
    }
  };

  // Handle plan deletion
  const handleDeletePlan = async () => {
    if (!selectedPlan) return;

    try {
      await deletePlan.mutateAsync(selectedPlan.id);
      setDeletePlanDialogOpen(false);
      setSelectedPlan(null);
    } catch (error) {
      console.error('Failed to delete plan:', error);
    }
  };

  // Handle project deletion
  const handleDeleteProject = async () => {
    if (!projectId) return;

    try {
      await deleteProject.mutateAsync(projectId);
      setDeleteProjectDialogOpen(false);
      await navigate('/projects');
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  // Loading state
  if (projectQuery.isLoading || plansQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="glass-card p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded w-1/3"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (projectQuery.isError) {
    return (
      <div className="glass-card p-6 bg-red-50 border-red-200">
        <div className="flex items-center space-x-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-red-900">Error Loading Project</h3>
            <p className="text-red-700">
              {projectQuery.error instanceof Error ? projectQuery.error.message : 'Failed to load project'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const project = projectQuery.data;
  const plans = plansQuery.data?.items ?? [];

  if (!project) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center space-x-2 text-sm">
          <li>
            <Link to="/projects" className="text-primary-600 hover:text-primary-700 hover:underline">
              Projects
            </Link>
          </li>
          <li className="text-slate-400">/</li>
          <li className="text-slate-700 font-medium">{project.name}</li>
        </ol>
      </nav>

      {/* Project Metadata Card */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <h1 className="text-3xl font-bold text-slate-900">{project.name}</h1>
            {project.description && (
              <p className="text-slate-600 max-w-2xl">{project.description}</p>
            )}
            <div className="flex flex-wrap gap-6 text-sm text-slate-600">
              <div className="flex items-center space-x-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>
                  <strong>{plans.length}</strong> plan{plans.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span>Created {formatDate(project.createdAt)}</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>Updated {formatDate(project.updatedAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setExportDialogOpen(true)}
              className="px-4 py-2 bg-secondary-600 text-white rounded-md hover:bg-secondary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2"
            >
              Export
            </button>
            <button
              onClick={() => setUploadDialogOpen(true)}
              className="btn-primary"
            >
              Upload PDF
            </button>
          </div>
        </div>

        {/* Export Success/Error Message */}
        {exportMessage && (
          <div
            className={`mt-4 p-3 rounded-lg border ${
              exportMessage.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            <div className="flex items-center space-x-2">
              {exportMessage.type === 'success' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
              <span className="text-sm font-medium">{exportMessage.text}</span>
            </div>
          </div>
        )}
      </div>

      {/* Plans Gallery */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Plans</h2>

        {plansQuery.isError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">
              {plansQuery.error instanceof Error ? plansQuery.error.message : 'Failed to load plans'}
            </p>
          </div>
        )}

        {plans.length === 0 ? (
          <div className="text-center py-12">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mx-auto h-12 w-12 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-slate-900">No plans yet</h3>
            <p className="mt-2 text-slate-600">Get started by uploading a PDF plan.</p>
            <button
              onClick={() => setUploadDialogOpen(true)}
              className="mt-4 btn-primary"
            >
              Upload your first plan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="bg-white rounded-lg shadow-md overflow-hidden border border-slate-200 hover:shadow-lg transition-shadow"
              >
                {/* Thumbnail */}
                <div className="bg-slate-100">
                  <PlanThumbnail
                    fileUrl={`/api/projects/${projectId}/plans/${plan.id}/file`}
                    alt={plan.name}
                    className="w-full"
                  />
                </div>

                {/* Plan Info */}
                <div className="p-4 space-y-3">
                  <h3 className="font-semibold text-slate-900 truncate" title={plan.name}>
                    {plan.name}
                  </h3>

                  <div className="space-y-1 text-sm text-slate-600">
                    <div className="flex justify-between">
                      <span>Pages:</span>
                      <span className="font-medium">{plan.pageCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Size:</span>
                      <span className="font-medium">{formatFileSize(plan.fileSize)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Uploaded:</span>
                      <span className="font-medium">{formatDate(plan.createdAt)}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => navigate(`/projects/${projectId}/plans/${plan.id}/takeoff`)}
                      className="flex-1 px-3 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 transition-colors"
                    >
                      Open Takeoff
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPlan(plan);
                        setDeletePlanDialogOpen(true);
                      }}
                      className="px-3 py-2 bg-red-50 text-red-600 text-sm rounded hover:bg-red-100 transition-colors"
                      title="Delete plan"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="glass-card p-6 bg-red-50 border-red-200">
        <h2 className="text-xl font-semibold text-red-900 mb-3">Danger Zone</h2>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-red-900">Delete this project</h3>
            <p className="text-sm text-red-700">
              Once deleted, this project and all its plans cannot be recovered.
            </p>
          </div>
          <button
            onClick={() => setDeleteProjectDialogOpen(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Delete Project
          </button>
        </div>
      </div>

      {/* Upload Plan Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        title="Upload PDF Plan"
        description="Select a PDF file to upload to this project"
      >
        <div className="space-y-4">
          {uploadError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {uploadError}
            </div>
          )}
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors">
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleFileUpload(file);
                }
              }}
              className="hidden"
              id="pdf-upload"
            />
            <label
              htmlFor="pdf-upload"
              className="cursor-pointer flex flex-col items-center space-y-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-sm text-slate-600">
                Click to select a PDF file or drag and drop
              </span>
              <span className="text-xs text-slate-500">PDF files only</span>
            </label>
          </div>
          {uploadPlan.isPending && (
            <div className="flex items-center justify-center space-x-2 text-primary-600">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
              <span>Uploading...</span>
            </div>
          )}
        </div>
      </Dialog>

      {/* Delete Plan Confirmation Dialog */}
      <Dialog
        open={deletePlanDialogOpen}
        onOpenChange={setDeletePlanDialogOpen}
        title="Delete Plan"
        description="Are you sure you want to delete this plan? This action cannot be undone."
        footer={
          <>
            <button
              onClick={() => {
                setDeletePlanDialogOpen(false);
                setSelectedPlan(null);
              }}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleDeletePlan()}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              disabled={deletePlan.isPending}
            >
              {deletePlan.isPending ? 'Deleting...' : 'Delete Plan'}
            </button>
          </>
        }
      >
        {selectedPlan && (
          <div className="space-y-2">
            <p className="font-medium text-slate-900">{selectedPlan.name}</p>
            <p className="text-sm text-slate-600">
              {selectedPlan.pageCount} page{selectedPlan.pageCount !== 1 ? 's' : ''} · {formatFileSize(selectedPlan.fileSize)}
            </p>
          </div>
        )}
      </Dialog>

      {/* Delete Project Confirmation Dialog */}
      <Dialog
        open={deleteProjectDialogOpen}
        onOpenChange={setDeleteProjectDialogOpen}
        title="Delete Project"
        description="Are you sure you want to delete this project? All plans and data will be permanently deleted."
        footer={
          <>
            <button
              onClick={() => setDeleteProjectDialogOpen(false)}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleDeleteProject()}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              disabled={deleteProject.isPending}
            >
              {deleteProject.isPending ? 'Deleting...' : 'Delete Project'}
            </button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="font-medium text-slate-900">{project.name}</p>
          <p className="text-sm text-slate-600">
            This project has {plans.length} plan{plans.length !== 1 ? 's' : ''}
          </p>
        </div>
      </Dialog>

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        projectId={projectId}
        onSuccess={(filename) => {
          setExportMessage({ text: `Successfully downloaded ${filename}`, type: 'success' });
          setTimeout(() => setExportMessage(null), 5000);
        }}
        onError={(error) => {
          setExportMessage({ text: error.message, type: 'error' });
          setTimeout(() => setExportMessage(null), 8000);
        }}
      />
    </div>
  );
}
