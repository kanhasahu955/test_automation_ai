import type { Cadence } from "@utils/cron";

import { BaseApiClient } from "./BaseApiClient";

export type ScheduleTargetType = "TEST_SUITE" | "NO_CODE_FLOW" | "STM_DOCUMENT";
export type ScheduleStatus = "ACTIVE" | "PAUSED";

export type Schedule = {
  id: string;
  project_id: string;
  name: string;
  description?: string | null;
  target_type: ScheduleTargetType;
  target_id: string;
  cadence_kind: "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM";
  cadence_config?: Record<string, unknown> | null;
  cron_expression: string;
  timezone: string;
  status: ScheduleStatus;
  expires_at?: string | null;
  last_run_at?: string | null;
  last_run_id?: string | null;
  next_run_at?: string | null;
  total_runs: number;
  success_runs: number;
  failure_runs: number;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ScheduleCreateInput = {
  name: string;
  description?: string | null;
  target_type: ScheduleTargetType;
  target_id: string;
  cadence: Cadence;
  timezone: string;
  status?: ScheduleStatus;
  expires_at?: string | null;
};

export type ScheduleUpdateInput = {
  name?: string;
  description?: string | null;
  cadence?: Cadence;
  timezone?: string;
  status?: ScheduleStatus;
  expires_at?: string | null;
};

export type SchedulePreview = {
  cron_expression: string;
  timezone: string;
  next_runs: string[];
  description: string;
};

export type ScheduleListFilters = {
  status?: ScheduleStatus;
  targetType?: ScheduleTargetType;
};

export class ScheduleApiClient extends BaseApiClient {
  list(projectId: string, filters?: ScheduleListFilters): Promise<Schedule[]> {
    return this.get<Schedule[]>(`/projects/${projectId}/schedules`, {
      params: {
        status_filter: filters?.status,
        target_type: filters?.targetType,
      },
    });
  }

  create(projectId: string, payload: ScheduleCreateInput): Promise<Schedule> {
    return this.post<Schedule, ScheduleCreateInput>(
      `/projects/${projectId}/schedules`,
      payload,
    );
  }

  getById(id: string): Promise<Schedule> {
    return this.get<Schedule>(`/schedules/${id}`);
  }

  update(id: string, payload: ScheduleUpdateInput): Promise<Schedule> {
    return this.patch<Schedule, ScheduleUpdateInput>(`/schedules/${id}`, payload);
  }

  remove(id: string): Promise<void> {
    return this.delete<void>(`/schedules/${id}`);
  }

  pause(id: string): Promise<Schedule> {
    return this.post<Schedule>(`/schedules/${id}/pause`);
  }

  resume(id: string): Promise<Schedule> {
    return this.post<Schedule>(`/schedules/${id}/resume`);
  }

  runNow(id: string): Promise<{ ok: boolean; run_id: string; schedule_id: string }> {
    return this.post<{ ok: boolean; run_id: string; schedule_id: string }>(
      `/schedules/${id}/run-now`,
    );
  }

  preview(payload: {
    cadence: Cadence;
    timezone: string;
    occurrences?: number;
  }): Promise<SchedulePreview> {
    return this.post<SchedulePreview, typeof payload>(`/schedules/preview`, payload);
  }
}

const client = new ScheduleApiClient();

export const scheduleApi = {
  list: (projectId: string, filters?: ScheduleListFilters) =>
    client.list(projectId, filters),
  create: (projectId: string, payload: ScheduleCreateInput) =>
    client.create(projectId, payload),
  get: (id: string) => client.getById(id),
  update: (id: string, payload: ScheduleUpdateInput) => client.update(id, payload),
  remove: (id: string) => client.remove(id),
  pause: (id: string) => client.pause(id),
  resume: (id: string) => client.resume(id),
  runNow: (id: string) => client.runNow(id),
  preview: (payload: {
    cadence: Cadence;
    timezone: string;
    occurrences?: number;
  }) => client.preview(payload),
};
