import dagre from "dagre";

import type { LiveForeignKeyEdge, LiveTable } from "@services/dataSourcesApi";

import { dedupeLiveTables, encodeTableKey } from "./schemaKeys";

/** Match custom node width/height in buildSchemaGraph + SchemaEntityNodes */
export const TABLE_NODE_W = 220;
export const TABLE_NODE_H = 96;
const GAP_DB_TO_TABLES = 28;
const DB_NODE_W = 220;
const DB_NODE_H = 120;
const TOP_MARGIN = 32;

type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

function emptyBounds(): Bounds {
  return { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
}

function mergeBounds(b: Bounds, x: number, y: number, w: number, h: number): void {
  b.minX = Math.min(b.minX, x);
  b.minY = Math.min(b.minY, y);
  b.maxX = Math.max(b.maxX, x + w);
  b.maxY = Math.max(b.maxY, y + h);
}

/**
 * Lay out table nodes with Dagre (FKs as directed edges) so the ER view is
 * readable; positions are top-left for React Flow.
 */
export function layoutTableNodesDagre(
  tables: LiveTable[],
  relations: LiveForeignKeyEdge[],
): { positions: Map<string, { x: number; y: number }>; dbPosition: { x: number; y: number } } {
  const uniqueTables = dedupeLiveTables(tables);
  if (uniqueTables.length === 0) {
    return { positions: new Map(), dbPosition: { x: 20, y: 80 } };
  }

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "LR",
    /** Extra horizontal/vertical space between table boxes */
    nodesep: 64,
    ranksep: 96,
    marginx: 32,
    marginy: 32,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const tset = new Set<string>();
  for (const t of uniqueTables) {
    const k = encodeTableKey(t.schema_name, t.table_name);
    tset.add(k);
    g.setNode(k, { width: TABLE_NODE_W, height: TABLE_NODE_H });
  }

  const directed = new Set<string>();
  for (const r of relations) {
    const s = encodeTableKey(r.constrained_schema, r.constrained_table);
    const t = encodeTableKey(r.referred_schema, r.referred_table);
    if (!tset.has(s) || !tset.has(t) || s === t) continue;
    const dkey = `${s}::${t}`;
    if (directed.has(dkey)) continue;
    directed.add(dkey);
    g.setEdge(s, t);
  }

  dagre.layout(g);

  const raw = new Map<string, { x: number; y: number }>();
  const rawBounds = emptyBounds();
  let failIdx = 0;
  for (const t of uniqueTables) {
    const k = encodeTableKey(t.schema_name, t.table_name);
    const n = g.node(k) as { x: number; y: number } | undefined;
    if (n) {
      const x = n.x - TABLE_NODE_W / 2;
      const y = n.y - TABLE_NODE_H / 2;
      raw.set(k, { x, y });
      mergeBounds(rawBounds, x, y, TABLE_NODE_W, TABLE_NODE_H);
    } else {
      const col = failIdx % 4;
      const row = Math.floor(failIdx / 4);
      failIdx += 1;
      const x = 32 + col * (TABLE_NODE_W + 40);
      const y = 32 + row * (TABLE_NODE_H + 40);
      raw.set(k, { x, y });
      mergeBounds(rawBounds, x, y, TABLE_NODE_W, TABLE_NODE_H);
    }
  }

  const shiftX = DB_NODE_W + GAP_DB_TO_TABLES - rawBounds.minX;
  const shiftY = TOP_MARGIN - rawBounds.minY;

  const positions = new Map<string, { x: number; y: number }>();
  const shifted = emptyBounds();
  for (const k of raw.keys()) {
    const p = raw.get(k)!;
    const next = { x: p.x + shiftX, y: p.y + shiftY };
    positions.set(k, next);
    mergeBounds(shifted, next.x, next.y, TABLE_NODE_W, TABLE_NODE_H);
  }

  const centerY = (shifted.minY + shifted.maxY) / 2;
  const dbY = centerY - DB_NODE_H / 2;
  return { positions, dbPosition: { x: 20, y: dbY } };
}
