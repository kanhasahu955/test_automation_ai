import { useAppSelector } from "@app/store";
import type { Project } from "@apptypes/api";

/**
 * Single source for "current selected project" across pages.
 *
 * Replaces ~10 copies of `useAppSelector((s) => s.projects.selected)`.
 */
export const useSelectedProject = (): {
  project: Project | null;
  projectId: string | null;
  hasProject: boolean;
} => {
  const project = useAppSelector((s) => s.projects.selected);
  return {
    project,
    projectId: project?.id ?? null,
    hasProject: !!project,
  };
};

export default useSelectedProject;
