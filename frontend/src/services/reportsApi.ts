import { BaseApiClient } from "./BaseApiClient";

export type DashboardKPIs = {
  project_id: string;
  total_test_cases: number;
  automated_test_cases: number;
  manual_test_cases: number;
  pass_rate: number;
  fail_rate: number;
  flaky_tests: number;
  avg_execution_time_ms: number;
  data_quality_score: number;
  failed_quality_rules: number;
  schema_drift_count: number;
  stm_validation_failures: number;
  latest_run_status?: string;
  latest_run_at?: string;
};

export type QualityScore = {
  test_pass_rate: number;
  data_quality: number;
  automation_coverage: number;
  defect_leakage: number;
  pipeline_stability: number;
  final_score: number;
};

export type TrendPoint = {
  date: string;
  pass_rate: number;
  fail_rate: number;
  runs: number;
  passed: number;
  failed: number;
  skipped: number;
};

export type TrendReport = { project_id: string; points: TrendPoint[] };

export type TestCaseCounts = {
  total: number;
  automated: number;
  manual: number;
  ready: number;
  draft: number;
};

export type ExecutionCounts = {
  total: number;
  running: number;
  pending: number;
  today_total: number;
  today_passed: number;
  today_failed: number;
  last_24h_pass_rate: number;
};

export type ScheduleCounts = {
  total: number;
  active: number;
  paused: number;
  next_fire_at?: string | null;
};

export type TopFailingTest = {
  test_case_id: string;
  title: string;
  failures: number;
  last_failed_at?: string | null;
};

export type ActivityItem = {
  run_id: string;
  status: string;
  run_type: string;
  suite_id?: string | null;
  flow_id?: string | null;
  schedule_id?: string | null;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  skipped_tests: number;
  started_at?: string | null;
  finished_at?: string | null;
  created_at?: string | null;
};

export type QualityOverview = {
  project_id: string;
  test_cases: TestCaseCounts;
  executions: ExecutionCounts;
  schedules: ScheduleCounts;
  regressions_count: number;
  top_failing_tests: TopFailingTest[];
  recent_activity: ActivityItem[];
};

export type RegressionItem = {
  test_case_id: string;
  title: string;
  current_status: string;
  previous_status: string;
  current_run_id: string;
  previous_run_id: string;
  broken_at?: string | null;
  error_message?: string | null;
};

export class ReportsApiClient extends BaseApiClient {
  dashboard(projectId: string): Promise<DashboardKPIs> {
    return this.get<DashboardKPIs>(`/projects/${projectId}/dashboard`);
  }

  qualityScore(projectId: string): Promise<QualityScore> {
    return this.get<QualityScore>(`/projects/${projectId}/quality-score`);
  }

  trend(projectId: string, days = 14): Promise<TrendReport> {
    return this.get<TrendReport>(`/projects/${projectId}/trend-report`, { params: { days } });
  }

  overview(projectId: string): Promise<QualityOverview> {
    return this.get<QualityOverview>(`/projects/${projectId}/quality-overview`);
  }

  regressions(projectId: string, limit = 50): Promise<RegressionItem[]> {
    return this.get<RegressionItem[]>(`/projects/${projectId}/regressions`, { params: { limit } });
  }
}

const client = new ReportsApiClient();

export const reportsApi = {
  dashboard: (projectId: string) => client.dashboard(projectId),
  qualityScore: (projectId: string) => client.qualityScore(projectId),
  trend: (projectId: string, days = 14) => client.trend(projectId, days),
  overview: (projectId: string) => client.overview(projectId),
  regressions: (projectId: string, limit = 50) => client.regressions(projectId, limit),
};
