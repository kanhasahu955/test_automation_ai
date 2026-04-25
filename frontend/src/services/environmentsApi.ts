import { BaseApiClient } from "./BaseApiClient";

export type Environment = {
  id: string;
  project_id: string;
  name: string;
  base_url: string;
  is_default?: boolean;
};

class Client extends BaseApiClient {
  listByProject(projectId: string): Promise<Environment[]> {
    return this.get<Environment[]>(`/projects/${projectId}/environments`);
  }
}

const client = new Client();

export const environmentsApi = {
  listByProject: (projectId: string) => client.listByProject(projectId),
};
