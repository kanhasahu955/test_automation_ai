import type { LiveTable } from "@services/dataSourcesApi";

export const DB_NODE_ID = "flow-db";

/** Stable string key for a table (schema + name). */
export function encodeTableKey(schema: string | null, table: string): string {
  return `tbl:${btoa(unescape(encodeURIComponent(JSON.stringify({ schema, table }))))}`;
}

export function decodeTableKey(k: string): { schema: string | null; table: string } | null {
  if (!k.startsWith("tbl:")) return null;
  try {
    const json = decodeURIComponent(escape(window.atob(k.slice(4))));
    return JSON.parse(json) as { schema: string | null; table: string };
  } catch {
    return null;
  }
}

export function buildTableNodeId(schema: string | null, table: string): string {
  return `n-${btoa(unescape(encodeURIComponent(JSON.stringify({ schema, table }))))}`;
}

export function decodeTableNodeId(id: string): { schema: string | null; table: string } | null {
  if (!id.startsWith("n-")) return null;
  try {
    const json = decodeURIComponent(escape(window.atob(id.slice(2))));
    return JSON.parse(json) as { schema: string | null; table: string };
  } catch {
    return null;
  }
}

export function buildColumnNodeId(tableKey: string, colName: string): string {
  return `cnode:${btoa(unescape(encodeURIComponent(JSON.stringify({ k: tableKey, n: colName }))))}`;
}

export function decodeColumnNodeId(id: string): { tableKey: string; colName: string } | null {
  if (!id.startsWith("cnode:")) return null;
  try {
    const json = decodeURIComponent(escape(window.atob(id.slice(6))));
    const o = JSON.parse(json) as { k: string; n: string };
    return { tableKey: o.k, colName: o.n };
  } catch {
    return null;
  }
}

/** Alias used by the antd Tree (same encoding as {@link encodeTableKey}). */
export const encodeTableRef = encodeTableKey;
export const decodeTableRef = decodeTableKey;

export function dedupeLiveTables(tables: LiveTable[]): LiveTable[] {
  const byKey = new Map<string, LiveTable>();
  for (const t of tables) {
    const k = encodeTableKey(t.schema_name, t.table_name);
    if (!byKey.has(k)) byKey.set(k, t);
  }
  return [...byKey.values()];
}
