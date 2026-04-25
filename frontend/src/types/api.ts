export type UserRole =
  | "ADMIN"
  | "QA_MANAGER"
  | "QA_ENGINEER"
  | "DATA_ENGINEER"
  | "DEVELOPER";

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  owner_id?: string;
  status: "ACTIVE" | "ARCHIVED";
  created_at?: string;
  updated_at?: string;
};

export type Page<T> = {
  items: T[];
  page: number;
  size: number;
  total: number;
  pages: number;
};

export type TestCaseStep = {
  id?: string;
  step_order: number;
  action: string;
  input_data?: Record<string, unknown> | null;
  expected_result?: string;
};

export type TestCase = {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  test_type: "MANUAL" | "API" | "UI" | "SQL" | "DATA_QUALITY" | "NO_CODE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "DRAFT" | "READY" | "DEPRECATED";
  preconditions?: string;
  expected_result?: string;
  created_by?: string;
  created_at?: string;
  steps: TestCaseStep[];
};

export type TestCaseInput = {
  title: string;
  description?: string;
  test_type: TestCase["test_type"];
  priority: TestCase["priority"];
  status: TestCase["status"];
  preconditions?: string;
  expected_result?: string;
  steps?: TestCaseStep[];
};

export type Flow = {
  id: string;
  project_id: string;
  test_case_id?: string;
  name: string;
  flow_json: Record<string, unknown>;
  generated_script?: string;
  runtime: "PLAYWRIGHT" | "PYTEST_API" | "SQL";
  created_at?: string;
};

export type FlowInput = {
  name: string;
  test_case_id?: string;
  flow_json: Record<string, unknown>;
  runtime: Flow["runtime"];
};

export type CompiledFlow = {
  runtime: Flow["runtime"];
  script: string;
  warnings: string[];
};
