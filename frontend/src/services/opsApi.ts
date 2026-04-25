import { BaseApiClient } from "./BaseApiClient";

export type HealthStatus = "ok" | "degraded" | "down" | "unknown";

export type ComponentHealth = {
  name: string;
  status: HealthStatus;
  detail?: string | null;
  latency_ms?: number | null;
  url?: string | null;
  docs_slug?: string | null;
};

export type CeleryQueueStat = {
  name: string;
  length: number;
  workers: string[];
};

export type CeleryWorker = {
  name: string;
  status: string;
  active: number;
  processed: number;
  queues: string[];
};

export type CeleryStatus = {
  status: HealthStatus;
  detail?: string | null;
  workers: CeleryWorker[];
  registered_tasks: string[];
  queues: CeleryQueueStat[];
};

export type RedisStatus = {
  status: HealthStatus;
  detail?: string | null;
  latency_ms?: number | null;
  used_memory_human?: string | null;
  connected_clients?: number | null;
  redbeat_keys?: number | null;
  db_keys: Record<string, number>;
};

export type OperationalLinks = {
  flower: ComponentHealth;
  redis_commander: ComponentHealth;
  airflow: ComponentHealth;
};

export type OperationsSnapshot = {
  api: ComponentHealth;
  database: ComponentHealth;
  redis: RedisStatus;
  celery: CeleryStatus;
  links: OperationalLinks;
};

export class OpsApiClient extends BaseApiClient {
  snapshot(): Promise<OperationsSnapshot> {
    return this.get<OperationsSnapshot>(`/ops/snapshot`);
  }
  database(): Promise<ComponentHealth> {
    return this.get<ComponentHealth>(`/ops/database`);
  }
  redis(): Promise<RedisStatus> {
    return this.get<RedisStatus>(`/ops/redis`);
  }
  celery(): Promise<CeleryStatus> {
    return this.get<CeleryStatus>(`/ops/celery`);
  }
  links(): Promise<OperationalLinks> {
    return this.get<OperationalLinks>(`/ops/links`);
  }
}

const client = new OpsApiClient();

export const opsApi = {
  snapshot: () => client.snapshot(),
  database: () => client.database(),
  redis: () => client.redis(),
  celery: () => client.celery(),
  links: () => client.links(),
};
