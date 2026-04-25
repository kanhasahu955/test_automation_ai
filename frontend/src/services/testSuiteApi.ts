import { BaseApiClient } from "./BaseApiClient";
import type { ExecutionRun } from "./executionApi";

export type SuiteType = "SMOKE" | "REGRESSION" | "SANITY" | "CUSTOM";

export type TestSuite = {
  id: string;
  project_id: string;
  name: string;
  description?: string | null;
  suite_type?: SuiteType | string | null;
  case_count?: number;
  created_by?: string | null;
  created_at?: string | null;
};

export type TestSuiteCreate = {
  name: string;
  description?: string | null;
  suite_type?: SuiteType;
};

export type SuiteCase = {
  id: string;
  suite_id: string;
  test_case_id: string;
  execution_order: number;
};

export type RunSuiteRequest = {
  environment_id?: string | null;
  triggered_by_label?: string | null;
};

export class TestSuiteApiClient extends BaseApiClient {
  list(projectId: string): Promise<TestSuite[]> {
    return this.get<TestSuite[]>(`/projects/${projectId}/test-suites`);
  }

  getById(id: string): Promise<TestSuite> {
    return this.get<TestSuite>(`/test-suites/${id}`);
  }

  create(projectId: string, payload: TestSuiteCreate): Promise<TestSuite> {
    return this.post<TestSuite, TestSuiteCreate>(`/projects/${projectId}/test-suites`, payload);
  }

  listCases(suiteId: string): Promise<SuiteCase[]> {
    return this.get<SuiteCase[]>(`/test-suites/${suiteId}/cases`);
  }

  addCase(
    suiteId: string,
    payload: { test_case_id: string; execution_order: number },
  ): Promise<SuiteCase> {
    return this.post<SuiteCase, { test_case_id: string; execution_order: number }>(
      `/test-suites/${suiteId}/cases`,
      payload,
    );
  }

  removeCase(suiteId: string, linkId: string): Promise<void> {
    return this.delete<void>(`/test-suites/${suiteId}/cases/${linkId}`);
  }

  run(suiteId: string, body?: RunSuiteRequest): Promise<ExecutionRun> {
    return this.post<ExecutionRun, RunSuiteRequest | undefined>(`/test-suites/${suiteId}/run`, body ?? {});
  }
}

const client = new TestSuiteApiClient();

export const testSuiteApi = {
  list: (projectId: string) => client.list(projectId),
  get: (id: string) => client.getById(id),
  create: (projectId: string, payload: TestSuiteCreate) => client.create(projectId, payload),
  listCases: (suiteId: string) => client.listCases(suiteId),
  addCase: (suiteId: string, payload: { test_case_id: string; execution_order: number }) =>
    client.addCase(suiteId, payload),
  removeCase: (suiteId: string, linkId: string) => client.removeCase(suiteId, linkId),
  run: (suiteId: string, body?: RunSuiteRequest) => client.run(suiteId, body),
};
