import type { Page, Project } from "@apptypes/api";

import { BaseApiClient } from "./BaseApiClient";

export type ProjectInput = { name: string; description?: string };

export class ProjectsApiClient extends BaseApiClient {
  constructor() {
    super("/projects");
  }

  list(page = 1, size = 20, search?: string): Promise<Page<Project>> {
    return this.get<Page<Project>>("", { params: { page, size, search } });
  }

  create(payload: ProjectInput): Promise<Project> {
    return this.post<Project, ProjectInput>("", payload);
  }

  getById(id: string): Promise<Project> {
    return this.get<Project>(`/${id}`);
  }

  update(id: string, payload: Partial<Project>): Promise<Project> {
    return this.put<Project, Partial<Project>>(`/${id}`, payload);
  }

  remove(id: string): Promise<void> {
    return this.delete<void>(`/${id}`);
  }
}

const client = new ProjectsApiClient();

export const projectsApi = {
  list: (page = 1, size = 20, search?: string) => client.list(page, size, search),
  create: (payload: ProjectInput) => client.create(payload),
  get: (id: string) => client.getById(id),
  update: (id: string, payload: Partial<Project>) => client.update(id, payload),
  remove: (id: string) => client.remove(id),
};
