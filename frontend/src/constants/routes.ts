/** Centralized route paths.
 *
 * Use these constants instead of magic strings to avoid drift between
 * `App.tsx` / `AppShell.tsx` / `navigate("…")` calls in pages.
 */
export const ROUTES = {
  LOGIN: "/login",
  REGISTER: "/register",

  ROOT: "/",
  DASHBOARD: "/dashboard",

  PROJECTS: "/projects",
  PROJECT_DETAIL: (id: string) => `/projects/${id}`,

  TEST_CASES: "/test-cases",
  TEST_CASE_DETAIL: (id: string) => `/test-cases/${id}`,
  TEST_SUITES: "/test-suites",

  FLOWS: "/flows",
  FLOW_NEW: "/flows/new",
  FLOW_DETAIL: (id: string) => `/flows/${id}`,

  AI: "/ai",
  STM: "/stm",
  PROFILING: "/profiling",
  METADATA: "/metadata",
  QUALITY: "/quality",
  EXECUTIONS: "/executions",
  SCHEDULES: "/schedules",
  SCHEDULE_DETAIL: (id: string) => `/schedules/${id}`,
  REPORTS: "/reports",
  OPERATIONS: "/operations",
  AUDIT_LOGS: "/audit-logs",
  NOTIFICATIONS: "/notifications",
  SETTINGS: "/settings",

  DOCS: "/docs",
  DOCS_PAGE: (slug: string) => `/docs/${slug}`,
} as const;

export type RouteKey = keyof typeof ROUTES;
