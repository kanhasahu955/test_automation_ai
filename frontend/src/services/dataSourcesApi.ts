import { BaseApiClient } from "./BaseApiClient";

export type DataSourceType =
  | "MYSQL"
  | "POSTGRESQL"
  | "SNOWFLAKE"
  | "BIGQUERY"
  | "API";

export type DataSource = {
  id: string;
  project_id: string;
  name: string;
  source_type: DataSourceType;
  host?: string | null;
  port?: number | null;
  database_name?: string | null;
  username?: string | null;
  is_active: boolean;
  created_at?: string;
};

export type TestConnectionResult = { ok: boolean; message: string };

export type DataSourceCreateInput = {
  name: string;
  source_type: DataSourceType;
  host?: string | null;
  port?: number | null;
  database_name?: string | null;
  username?: string | null;
  password?: string | null;
  extra_config?: Record<string, unknown> | null;
  is_active?: boolean;
};

export type DataSourceUpdateInput = Partial<DataSourceCreateInput>;

/** Domain client for data-source connections. */
export class DataSourcesApiClient extends BaseApiClient {
  list(projectId: string): Promise<DataSource[]> {
    return this.get<DataSource[]>(`/projects/${projectId}/data-sources`);
  }

  fetchOne(id: string): Promise<DataSource> {
    return this.get<DataSource>(`/data-sources/${id}`);
  }

  create(projectId: string, payload: DataSourceCreateInput): Promise<DataSource> {
    return this.post<DataSource, DataSourceCreateInput>(
      `/projects/${projectId}/data-sources`,
      payload,
    );
  }

  update(id: string, payload: DataSourceUpdateInput): Promise<DataSource> {
    return this.put<DataSource, DataSourceUpdateInput>(`/data-sources/${id}`, payload);
  }

  remove(id: string): Promise<void> {
    return this.delete<void>(`/data-sources/${id}`);
  }

  testConnection(id: string): Promise<TestConnectionResult> {
    return this.post<TestConnectionResult>(`/data-sources/${id}/test-connection`);
  }

  scanMetadata(id: string): Promise<{ status: string; data_source_id: string }> {
    return this.post<{ status: string; data_source_id: string }>(
      `/data-sources/${id}/scan-metadata`,
    );
  }
}

const client = new DataSourcesApiClient();

export const dataSourcesApi = {
  list: (projectId: string) => client.list(projectId),
  get: (id: string) => client.fetchOne(id),
  create: (projectId: string, payload: DataSourceCreateInput) =>
    client.create(projectId, payload),
  update: (id: string, payload: DataSourceUpdateInput) => client.update(id, payload),
  remove: (id: string) => client.remove(id),
  testConnection: (id: string) => client.testConnection(id),
  scanMetadata: (id: string) => client.scanMetadata(id),
};
