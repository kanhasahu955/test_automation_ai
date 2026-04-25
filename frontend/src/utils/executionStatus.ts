/** Centralized status → colour mapping shared by Executions / Reports tables. */
export type ExecutionStatus =
  | "PASSED"
  | "FAILED"
  | "RUNNING"
  | "PENDING"
  | "QUEUED"
  | "CANCELLED"
  | "SKIPPED"
  | "ERROR"
  | string;

const COLOR_MAP: Record<string, string> = {
  PASSED: "success",
  FAILED: "error",
  ERROR: "error",
  RUNNING: "processing",
  PENDING: "default",
  QUEUED: "default",
  CANCELLED: "warning",
  SKIPPED: "default",
};

export const executionStatusColor = (status: ExecutionStatus | undefined | null): string =>
  COLOR_MAP[(status ?? "").toUpperCase()] ?? "default";
