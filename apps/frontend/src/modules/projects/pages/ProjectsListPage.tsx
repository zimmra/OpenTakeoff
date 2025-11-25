/**
 * Projects List Page
 * Main project management interface with list view, creation dialog, and PDF upload
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects, useCreateProject } from '../hooks/useProjects';
import { CreateProjectDialog } from '../components/CreateProjectDialog';
import { ProjectCard } from '../components/ProjectCard';
import { EmptyState } from '../components/EmptyState';

export function ProjectsListPage() {
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { data: projectsData, isLoading } = useProjects();
  const createProject = useCreateProject();

  // Keyboard shortcut: Ctrl+N to open create dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setIsCreateDialogOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreateProject = async (name: string, description: string | undefined, pdfFile: File | null) => {
    try {
      // Create project first
      const project = await createProject.mutateAsync({
        name,
        ...(description && { description })
      });

      // If PDF provided, upload it
      if (pdfFile && project.id) {
        // Import the upload function directly
        const { plansApi } = await import('../api/plansApi');
        await plansApi.upload(project.id, pdfFile);
      }

      // Close dialog and navigate to project
      setIsCreateDialogOpen(false);
      await navigate(`/projects/${project.id}`);
    } catch (error) {
      // Error handling is done in the dialog component via toast
      console.error('Failed to create project:', error);
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-900">Projects</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-6 animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-slate-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const projects = projectsData?.items ?? [];
  const isEmpty = projects.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Projects</h1>
          <p className="text-slate-600 mt-1">
            Manage your construction plan take-off projects
          </p>
        </div>
        <button
          onClick={() => setIsCreateDialogOpen(true)}
          className="btn-primary flex items-center gap-2"
          title="Create New Project (Ctrl+N)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          New Project
        </button>
      </div>

      {/* Content */}
      {isEmpty ? (
        <EmptyState onCreateProject={() => setIsCreateDialogOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => navigate(`/projects/${project.id}`)}
            />
          ))}
        </div>
      )}

      {/* Create Project Dialog */}
      <CreateProjectDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateProject}
        isLoading={createProject.isPending}
      />
    </div>
  );
}
