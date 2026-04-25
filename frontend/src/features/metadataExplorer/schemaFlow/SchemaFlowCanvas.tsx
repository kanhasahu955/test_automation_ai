import { useCallback, useEffect, useMemo, type MouseEvent } from "react";
import {
  Background,
  Controls,
  MiniMap,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";

import type { LiveColumn, LiveForeignKeyEdge, LiveTable } from "@services/dataSourcesApi";

import { buildSchemaGraph } from "./buildSchemaGraph";
import { schemaEntityNodeTypes } from "./SchemaEntityNodes";
import { DB_NODE_ID, decodeColumnNodeId, decodeTableNodeId, encodeTableKey } from "./schemaKeys";

type ErPayload = { tables: LiveTable[]; relations: LiveForeignKeyEdge[]; database: string };

function ERFitView({ version }: { version: number }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const t = window.setTimeout(
      () => void fitView({ padding: 0.15, maxZoom: 1.2, duration: 220 }),
      60,
    );
    return () => window.clearTimeout(t);
  }, [version, fitView]);
  return null;
}

function FocusSelection({ nodeId, version }: { nodeId: string | null; version: number }) {
  const { fitView, getNode } = useReactFlow();
  useEffect(() => {
    if (!nodeId) return;
    const t = window.setTimeout(() => {
      const n = getNode(nodeId);
      if (n) {
        void fitView({
          nodes: [n],
          padding: 0.32,
          duration: 340,
          maxZoom: 1.55,
          minZoom: 0.04,
        });
      }
    }, 50);
    return () => window.clearTimeout(t);
  }, [nodeId, version, fitView, getNode]);
  return null;
}

const flowClass: Record<"default" | "expanded", string> = {
  default: "min-h-0 w-full min-h-[520px] flex-1",
  expanded: "min-h-0 h-full w-full min-h-[600px] flex-1",
};

export function SchemaFlowCanvas({
  payload,
  viewMode = "default",
  dbExpanded,
  tableColumnKey,
  columnsByTableKey,
  selectedNodeId,
  onSelectNode,
  onDatabaseClick,
  onTableClick,
  onColumnClick,
  onPaneClick,
  focusKey,
}: {
  payload: ErPayload;
  viewMode?: "default" | "expanded";
  dbExpanded: boolean;
  tableColumnKey: string | null;
  columnsByTableKey: Record<string, LiveColumn[]>;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onDatabaseClick: () => void;
  onTableClick: (schema: string | null, table: string, tableKey: string) => void;
  onColumnClick: (tableKey: string, colName: string, col: LiveColumn) => void;
  onPaneClick?: () => void;
  focusKey: number;
}) {
  const { nodes, edges, version: graphVersion } = useMemo(() => {
    return buildSchemaGraph(payload.database, payload.tables, payload.relations, {
      dbExpanded,
      tableColumnKey,
      columnsByTableKey,
      selectedNodeId,
    });
  }, [payload, dbExpanded, tableColumnKey, columnsByTableKey, selectedNodeId]);

  const [nState, setNodes, onNodesChange] = useNodesState(nodes);
  const [eState, setEdges, onEdgesChange] = useEdgesState(edges);

  useEffect(() => {
    setNodes(nodes);
    setEdges(edges);
  }, [nodes, edges, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: MouseEvent, node: Node) => {
      const { id } = node;
      if (id === DB_NODE_ID) {
        onDatabaseClick();
        onSelectNode(id);
        return;
      }
      const t = decodeTableNodeId(id);
      if (t) {
        onTableClick(t.schema, t.table, encodeTableKey(t.schema, t.table));
        onSelectNode(id);
        return;
      }
      const c = decodeColumnNodeId(id);
      if (c) {
        const cols = columnsByTableKey[c.tableKey] ?? [];
        const col = cols.find((x) => x.name === c.colName);
        if (col) onColumnClick(c.tableKey, c.colName, col);
        onSelectNode(id);
      }
    },
    [columnsByTableKey, onColumnClick, onDatabaseClick, onTableClick, onSelectNode],
  );

  return (
    <div className={`rounded-lg border border-solid border-[var(--color-border)] ${flowClass[viewMode]}`}>
      <ReactFlow
        nodeTypes={schemaEntityNodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
        nodes={nState}
        edges={eState}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={() => {
          onSelectNode(null);
          onPaneClick?.();
        }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        minZoom={0.05}
        maxZoom={viewMode === "expanded" ? 2.5 : 2.2}
        defaultEdgeOptions={{
          style: { strokeWidth: 2 },
        }}
      >
        <Background />
        <Controls showInteractive className="!shadow-md" />
        <MiniMap
          pannable
          zoomable
          className="!bottom-2.5 !right-2.5 !h-20 !w-28 !min-h-0 !min-w-0 !rounded-md !border !border-solid !border-[var(--color-border)] !bg-[var(--color-surface-elevated)] !shadow-sm"
          maskColor="color-mix(in srgb, var(--color-ink) 8%, transparent)"
          nodeClassName="!rounded"
          style={{ zIndex: 4 }}
        />
        <ERFitView version={graphVersion} />
        <FocusSelection nodeId={selectedNodeId} version={graphVersion + focusKey} />
      </ReactFlow>
    </div>
  );
}

