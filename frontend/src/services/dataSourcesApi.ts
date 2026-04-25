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
  /** e.g. `{ sslmode: "require" }` for Neon / Supabase (PostgreSQL). */
  extra_config?: Record<string, unknown> | null;
  is_active: boolean;
  created_at?: string;
};

export type TestConnectionResult = { ok: boolean; message: string };

export type LiveTable = { schema_name: string | null; table_name: string };

export type LiveColumn = {
  name: string;
  data_type: string;
  nullable: boolean;
  is_pk: boolean;
  is_fk: boolean;
  default: string | null;
  autoincrement: boolean | null;
  comment: string | null;
};

export type LiveForeignKeyEdge = {
  constrained_schema: string | null;
  constrained_table: string;
  constrained_column: string;
  referred_schema: string | null;
  referred_table: string;
  referred_column: string;
};

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

  listDatabases(id: string): Promise<{ databases: string[] }> {
    return this.get<{ databases: string[] }>(`/data-sources/${id}/databases`);
  }

  liveTables(id: string, database: string): Promise<{ tables: LiveTable[] }> {
    return this.get<{ tables: LiveTable[] }>(`/data-sources/${id}/live/tables`, {
      params: { database },
    });
  }

  liveColumns(
    id: string,
    params: { database: string; table: string; schema?: string | null },
  ): Promise<{ columns: LiveColumn[] }> {
    return this.get<{ columns: LiveColumn[] }>(`/data-sources/${id}/live/columns`, {
      params: {
        database: params.database,
        table: params.table,
        schema: params.schema && params.schema.trim() ? params.schema : undefined,
      },
    });
  }

  liveRelations(id: string, database: string): Promise<{ relations: LiveForeignKeyEdge[] }> {
    return this.get<{ relations: LiveForeignKeyEdge[] }>(
      `/data-sources/${id}/live/relations`,
      { params: { database } },
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
  listDatabases: (id: string) => client.listDatabases(id),
  liveTables: (id: string, database: string) => client.liveTables(id, database),
  liveColumns: (id: string, params: { database: string; table: string; schema?: string | null }) =>
    client.liveColumns(id, params),
  liveRelations: (id: string, database: string) => client.liveRelations(id, database),
};
