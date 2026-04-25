import type { Page, TestCase, TestCaseInput } from "@apptypes/api";

import { BaseApiClient } from "./BaseApiClient";

export class TestCaseApiClient extends BaseApiClient {
  list(projectId: string, page = 1, size = 20, search?: string): Promise<Page<TestCase>> {
    return this.get<Page<TestCase>>(`/projects/${projectId}/test-cases`, {
      params: { page, size, search },
    });
  }

  create(projectId: string, payload: TestCaseInput): Promise<TestCase> {
    return this.post<TestCase, TestCaseInput>(`/projects/${projectId}/test-cases`, payload);
  }

  getById(id: string): Promise<TestCase> {
    return this.get<TestCase>(`/test-cases/${id}`);
  }

  update(id: string, payload: Partial<TestCaseInput>): Promise<TestCase> {
    return this.put<TestCase, Partial<TestCaseInput>>(`/test-cases/${id}`, payload);
  }

  remove(id: string): Promise<void> {
    return this.delete<void>(`/test-cases/${id}`);
  }
}

const client = new TestCaseApiClient();

export const testCaseApi = {
  list: (projectId: string, page = 1, size = 20, search?: string) =>
    client.list(projectId, page, size, search),
  create: (projectId: string, payload: TestCaseInput) => client.create(projectId, payload),
  get: (id: string) => client.getById(id),
  update: (id: string, payload: Partial<TestCaseInput>) => client.update(id, payload),
  remove: (id: string) => client.remove(id),
};
