import { BaseApiClient } from "./BaseApiClient";

export type MetadataTable = {
  id: string;
  data_source_id: string;
  schema_name?: string | null;
  table_name: string;
  table_type?: string | null;
  row_count?: number | null;
  quality_score?: number | string | null;
  last_scanned_at?: string | null;
  created_at?: string | null;
};

export type MetadataColumn = {
  id: string;
  metadata_table_id: string;
  column_name: string;
  data_type?: string | null;
  is_nullable?: boolean | null;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  distinct_count?: number | null;
  null_count?: number | null;
  null_percentage?: number | string | null;
  min_value?: string | null;
  max_value?: string | null;
  sample_values?: unknown[] | null;
};

export type MetadataSummary = {
  table_count: number;
  column_count: number;
  total_rows: number;
  avg_quality_score: number | null;
  last_scanned_at: string | null;
};

export type MetadataColumnHit = {
  id: string;
  metadata_table_id: string;
  column_name: string;
  data_type?: string | null;
  table_name: string;
  schema_name?: string | null;
};

export type MetadataSearchResults = {
  tables: MetadataTable[];
  columns: MetadataColumnHit[];
};

/** Domain client for the metadata catalog (tables + columns). */
export class MetadataApiClient extends BaseApiClient {
  listTables(dataSourceId: string): Promise<MetadataTable[]> {
    return this.get<MetadataTable[]>(`/data-sources/${dataSourceId}/metadata/tables`);
  }

  getTable(tableId: string): Promise<MetadataTable> {
    return this.get<MetadataTable>(`/metadata/tables/${tableId}`);
  }

  listColumns(tableId: string): Promise<MetadataColumn[]> {
    return this.get<MetadataColumn[]>(`/metadata/tables/${tableId}/columns`);
  }

  getColumn(columnId: string): Promise<MetadataColumn> {
    return this.get<MetadataColumn>(`/metadata/columns/${columnId}`);
  }

  getSummary(dataSourceId: string): Promise<MetadataSummary> {
    return this.get<MetadataSummary>(
      `/data-sources/${dataSourceId}/metadata/summary`,
    );
  }

  search(
    dataSourceId: string,
    query: string,
    limit = 50,
  ): Promise<MetadataSearchResults> {
    return this.get<MetadataSearchResults>(
      `/data-sources/${dataSourceId}/metadata/search`,
      { params: { q: query, limit } },
    );
  }
}

const client = new MetadataApiClient();

export const metadataApi = {
  listTables: (dataSourceId: string) => client.listTables(dataSourceId),
  getTable: (tableId: string) => client.getTable(tableId),
  listColumns: (tableId: string) => client.listColumns(tableId),
  getColumn: (columnId: string) => client.getColumn(columnId),
  getSummary: (dataSourceId: string) => client.getSummary(dataSourceId),
  search: (dataSourceId: string, query: string, limit?: number) =>
    client.search(dataSourceId, query, limit),
};
