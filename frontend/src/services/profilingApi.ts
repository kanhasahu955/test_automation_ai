import { BaseApiClient } from "./BaseApiClient";

export type ProfilingStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

export type ProfilingRun = {
  id: string;
  project_id: string;
  data_source_id: string;
  status: ProfilingStatus;
  started_at?: string | null;
  finished_at?: string | null;
  overall_quality_score?: number | string | null;
  summary_json?: Record<string, unknown> | null;
  created_at?: string | null;
};

/** Domain client for the data-profiling API. */
export class ProfilingApiClient extends BaseApiClient {
  trigger(dataSourceId: string): Promise<ProfilingRun> {
    return this.post<ProfilingRun>(`/data-sources/${dataSourceId}/profile`);
  }

  list(projectId: string): Promise<ProfilingRun[]> {
    return this.get<ProfilingRun[]>(`/projects/${projectId}/profiling-runs`);
  }

  fetchOne(runId: string): Promise<ProfilingRun> {
    return this.get<ProfilingRun>(`/profiling-runs/${runId}`);
  }
}

const client = new ProfilingApiClient();

export const profilingApi = {
  trigger: (dataSourceId: string) => client.trigger(dataSourceId),
  list: (projectId: string) => client.list(projectId),
  get: (runId: string) => client.fetchOne(runId),
};
