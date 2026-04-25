import { BaseApiClient } from "./BaseApiClient";

export type GeneratedTestCase = {
  title: string;
  description?: string;
  preconditions?: string;
  expected_result?: string;
  priority?: string;
  test_type?: string;
  steps?: { step_order: number; action: string; expected_result?: string }[];
};

export type GenerateTestCasesResponse = {
  items: GeneratedTestCase[];
  used_fallback: boolean;
};

export type GenerateFlowResponse = {
  flow_json: Record<string, unknown>;
  used_fallback: boolean;
};

export type GenerateSqlResponse = { sql: string };

export type FailureAnalysis = {
  summary: string;
  likely_root_cause: string;
  suggested_fix: string;
  is_flaky: boolean;
};

export type EdgeCasesResponse = { edge_cases: string[] };

export class AiApiClient extends BaseApiClient {
  constructor() {
    super("/ai");
  }

  generateTestCases(requirement: string, count = 5): Promise<GenerateTestCasesResponse> {
    return this.post<GenerateTestCasesResponse>("/generate-test-cases", { requirement, count });
  }

  generateFlow(scenario: string): Promise<GenerateFlowResponse> {
    return this.post<GenerateFlowResponse>("/generate-no-code-flow", { scenario });
  }

  generateSql(mappingJson: Record<string, unknown>): Promise<GenerateSqlResponse> {
    return this.post<GenerateSqlResponse>("/generate-sql-validation", { mapping_json: mappingJson });
  }

  analyzeFailure(test_name: string, error_message: string, logs?: string): Promise<FailureAnalysis> {
    return this.post<FailureAnalysis>("/analyze-failure", { test_name, error_message, logs });
  }

  edgeCases(requirement: string): Promise<EdgeCasesResponse> {
    return this.post<EdgeCasesResponse>("/suggest-edge-cases", { requirement });
  }
}

const client = new AiApiClient();

export const aiApi = {
  generateTestCases: (requirement: string, count = 5) => client.generateTestCases(requirement, count),
  generateFlow: (scenario: string) => client.generateFlow(scenario),
  generateSql: (mappingJson: Record<string, unknown>) => client.generateSql(mappingJson),
  analyzeFailure: (test_name: string, error_message: string, logs?: string) =>
    client.analyzeFailure(test_name, error_message, logs),
  edgeCases: (requirement: string) => client.edgeCases(requirement),
};
