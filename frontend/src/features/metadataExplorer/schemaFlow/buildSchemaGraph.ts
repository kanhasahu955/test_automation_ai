import type { CSSProperties } from "react";

import type { Edge, Node } from "@xyflow/react";

import type { LiveColumn, LiveForeignKeyEdge, LiveTable } from "@services/dataSourcesApi";
import { tokens } from "@theme/tokens";

import { layoutTableNodesDagre, TABLE_NODE_W } from "./layoutTableGraph";
import {
  buildColumnNodeId,
  buildTableNodeId,
  DB_NODE_ID,
  dedupeLiveTables,
  encodeTableKey,
} from "./schemaKeys";

const COL_NODE_W = 200;
const COL_LINE = 30;

type BuildOpts = {
  dbExpanded: boolean;
  /** encodeTableKey for table whose column nodes are visible */
  tableColumnKey: string | null;
  columnsByTableKey: Record<string, LiveColumn[]>;
  selectedNodeId: string | null;
};

function borderStyle(selected: boolean): CSSProperties {
  return {
    borderRadius: 8,
    border: `2px solid ${selected ? tokens.color.primary : "var(--color-border, rgba(0,0,0,0.12))"}`,
    boxShadow: selected
      ? `0 0 0 3px color-mix(in srgb, ${tokens.color.primary} 25%, transparent)`
      : "0 1px 2px rgba(0,0,0,0.08)",
  };
}

/**
 * Hierarchical graph: (1) only database, (2) + tables + FKs, (3) + column nodes for one table.
 */
export function buildSchemaGraph(
  database: string,
  tables: LiveTable[],
  relations: LiveForeignKeyEdge[],
  opts: BuildOpts,
): { nodes: Node[]; edges: Edge[]; version: number; focusHint: "db" | "tables" | "columns" } {
  const uniqueTables = dedupeLiveTables(tables);
  const tset = new Set(uniqueTables.map((t) => encodeTableKey(t.schema_name, t.table_name)));
  const idByKey = new Map<string, string>();
  for (const t of uniqueTables) {
    const k = encodeTableKey(t.schema_name, t.table_name);
    idByKey.set(k, buildTableNodeId(t.schema_name, t.table_name));
  }

  const posByKey = new Map<string, { x: number; y: number }>();

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  if (!opts.dbExpanded) {
    const dbOnlySelected = opts.selectedNodeId === DB_NODE_ID;
    nodes.push({
      id: DB_NODE_ID,
      type: "schemaDatabase",
      position: { x: 20, y: 140 },
      data: {
        label: database,
        isExpanded: false,
      },
      style: { width: 220, zIndex: 2, ...borderStyle(dbOnlySelected) },
    });
    return {
      nodes,
      edges,
      version: database.length,
      focusHint: "db",
    };
  }

  const { positions: tablePositions, dbPosition } = layoutTableNodesDagre(uniqueTables, relations);
  for (const t of uniqueTables) {
    const k = encodeTableKey(t.schema_name, t.table_name);
    const p = tablePositions.get(k);
    if (p) posByKey.set(k, p);
  }

  const dbSelected = opts.selectedNodeId === DB_NODE_ID;
  nodes.push({
    id: DB_NODE_ID,
    type: "schemaDatabase",
    position: dbPosition,
    data: {
      label: database,
      isExpanded: true,
    },
    style: { width: 220, zIndex: 2, ...borderStyle(dbSelected) },
  });

  let ei = 0;
  let ti = 0;
  uniqueTables.forEach((t) => {
    const k = encodeTableKey(t.schema_name, t.table_name);
    const id = idByKey.get(k)!;
    const p = posByKey.get(k);
    if (!p) return;
    const i = ti++;
    const { x, y } = p;
    const full = t.schema_name ? `${t.schema_name}.${t.table_name}` : t.table_name;
    const selected = id === opts.selectedNodeId;
    nodes.push({
      id,
      type: "schemaTable",
      position: { x, y },
      data: {
        label: full,
        tableName: t.table_name,
        schemaName: t.schema_name,
        isColumnParent: opts.tableColumnKey === k,
      },
      style: { width: TABLE_NODE_W, zIndex: 1, ...borderStyle(selected) },
    });
    edges.push({
      id: `db-t-${i}`,
      source: DB_NODE_ID,
      target: id,
      targetHandle: "t-in",
      style: { stroke: "var(--color-text-faint, #9ca3af)", strokeWidth: 2, strokeDasharray: "4 2" },
    });
  });

  for (const r of relations) {
    const sRef = encodeTableKey(r.constrained_schema, r.constrained_table);
    const tRef = encodeTableKey(r.referred_schema, r.referred_table);
    if (!tset.has(sRef) || !tset.has(tRef)) continue;
    const source = idByKey.get(sRef);
    const target = idByKey.get(tRef);
    if (!source || !target) continue;
    edges.push({
      id: `fk-${ei++}`,
      source,
      target,
      type: "smoothstep",
      sourceHandle: "t-out",
      targetHandle: "t-in",
      /** Kept on edge for a11y / future hover labels — avoids label spaghetti on the canvas */
      data: { fk: `${r.constrained_column} → ${r.referred_column}` } as { fk: string },
      animated: false,
      style: { stroke: tokens.color.primary, strokeWidth: 1.5, opacity: 0.85 },
    });
  }

  const colParent = opts.tableColumnKey;
  if (colParent) {
    const tableId = idByKey.get(colParent);
    const origin = posByKey.get(colParent);
    const cols = opts.columnsByTableKey[colParent] ?? [];
    if (tableId && origin && cols.length > 0) {
      const baseX = origin.x + TABLE_NODE_W + 24;
      const baseY = origin.y;
      cols.forEach((c, ci) => {
        const id = buildColumnNodeId(colParent, c.name);
        const selected = id === opts.selectedNodeId;
        nodes.push({
          id,
          type: "schemaColumn",
          position: { x: baseX, y: baseY + ci * COL_LINE },
          data: { column: c, tableKey: colParent, label: c.name, typeStr: c.data_type },
          style: { width: COL_NODE_W, zIndex: 0, minHeight: COL_LINE, ...borderStyle(selected) },
        });
        edges.push({
          id: `t-c-${ci}-${c.name}`,
          source: tableId,
          target: id,
          sourceHandle: "t-out",
          targetHandle: "c-in",
          style: { stroke: "var(--color-text-faint, #9ca3af)", strokeWidth: 1.5 },
        });
      });
    }
  }

  return {
    nodes,
    edges,
    version: database.length + uniqueTables.length + relations.length + (opts.dbExpanded ? 1 : 0) + (opts.tableColumnKey ? 2 : 0) + (opts.tableColumnKey ? (opts.columnsByTableKey[opts.tableColumnKey]?.length ?? 0) : 0),
    focusHint: opts.tableColumnKey && (opts.columnsByTableKey[opts.tableColumnKey]?.length ?? 0) > 0 ? "columns" : "tables",
  };
}
