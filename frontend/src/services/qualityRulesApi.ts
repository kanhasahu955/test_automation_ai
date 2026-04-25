import { BaseApiClient } from "./BaseApiClient";

export type RuleType =
  | "NOT_NULL"
  | "UNIQUE"
  | "RANGE"
  | "REGEX"
  | "ROW_COUNT"
  | "FRESHNESS"
  | "CUSTOM_SQL";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type QualityRule = {
  id: string;
  project_id: string;
  name: string;
  rule_type: RuleType;
  table_name: string | null;
  column_name: string | null;
  rule_config: Record<string, unknown> | null;
  severity: Severity;
  is_active: boolean;
  created_at: string | null;
};

export type QualityRuleCreate = {
  name: string;
  rule_type: RuleType;
  table_name?: string | null;
  column_name?: string | null;
  rule_config?: Record<string, unknown> | null;
  severity?: Severity;
  is_active?: boolean;
};

class Client extends BaseApiClient {
  list(projectId: string): Promise<QualityRule[]> {
    return this.get<QualityRule[]>(`/projects/${projectId}/quality-rules`);
  }

  create(projectId: string, payload: QualityRuleCreate): Promise<QualityRule> {
    return this.post<QualityRule, QualityRuleCreate>(`/projects/${projectId}/quality-rules`, payload);
  }

  remove(ruleId: string): Promise<void> {
    return this.delete<void>(`/quality-rules/${ruleId}`);
  }
}

const client = new Client();

export const qualityRulesApi = {
  list: (projectId: string) => client.list(projectId),
  create: (projectId: string, payload: QualityRuleCreate) => client.create(projectId, payload),
  remove: (ruleId: string) => client.remove(ruleId),
};
