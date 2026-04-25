import { BaseApiClient } from "./BaseApiClient";

export type TestSuite = {
  id: string;
  project_id: string;
  name: string;
  description?: string | null;
  suite_type?: string | null;
  created_at?: string | null;
};

export class TestSuiteApiClient extends BaseApiClient {
  list(projectId: string): Promise<TestSuite[]> {
    return this.get<TestSuite[]>(`/projects/${projectId}/test-suites`);
  }

  getById(id: string): Promise<TestSuite> {
    return this.get<TestSuite>(`/test-suites/${id}`);
  }
}

const client = new TestSuiteApiClient();

export const testSuiteApi = {
  list: (projectId: string) => client.list(projectId),
  get: (id: string) => client.getById(id),
};
