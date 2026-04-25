import { BaseApiClient } from "./BaseApiClient";

export type ExecutionRunStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "CANCELLED";
export type ExecutionResultStatus = "PASSED" | "FAILED" | "SKIPPED" | "ERROR";

export type ExecutionRun = {
  id: string;
  project_id: string;
  suite_id?: string;
  flow_id?: string;
  schedule_id?: string;
  triggered_by?: string;
  run_type: string;
  status: ExecutionRunStatus;
  started_at?: string;
  finished_at?: string;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  skipped_tests: number;
  created_at?: string;
};

export type ExecutionResult = {
  id: string;
  execution_run_id: string;
  test_case_id?: string;
  test_name?: string;
  flow_id?: string;
  flow_name?: string;
  status: ExecutionResultStatus;
  duration_ms?: number;
  error_message?: string;
  logs?: string;
  screenshot_path?: string;
  video_path?: string;
  created_at?: string;
};

export type ExecutionReport = { run: ExecutionRun; results: ExecutionResult[] };

export class ExecutionApiClient extends BaseApiClient {
  list(
    projectId: string,
    opts?: { scheduleId?: string; limit?: number },
  ): Promise<ExecutionRun[]> {
    return this.get<ExecutionRun[]>(`/projects/${projectId}/execution-runs`, {
      params: {
        schedule_id: opts?.scheduleId,
        limit: opts?.limit,
      },
    });
  }

  report(runId: string): Promise<ExecutionReport> {
    return this.get<ExecutionReport>(`/execution-runs/${runId}/report`);
  }
}

const client = new ExecutionApiClient();

export const executionApi = {
  list: (projectId: string, opts?: { scheduleId?: string; limit?: number }) =>
    client.list(projectId, opts),
  report: (runId: string) => client.report(runId),
};
