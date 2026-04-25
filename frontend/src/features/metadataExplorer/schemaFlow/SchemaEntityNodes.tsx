import { ApiOutlined, DatabaseOutlined, TableOutlined } from "@ant-design/icons";
import { Handle, type Node, type NodeProps, type NodeTypes, Position } from "@xyflow/react";
import { Space, Tag, Typography } from "antd";

import type { LiveColumn } from "@services/dataSourcesApi";
import { tokens } from "@theme/tokens";

const { Text } = Typography;

export type DatabaseNodeData = { label: string; isExpanded: boolean };

export function SchemaDatabaseNode({ data }: NodeProps<Node<DatabaseNodeData>>) {
  const d = data as unknown as DatabaseNodeData;
  return (
    <div
      className="relative rounded-xl px-3 py-3"
      style={{
        background: "var(--color-surface-elevated)",
        minWidth: 200,
        textAlign: "center",
        pointerEvents: "all",
      }}
    >
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-[var(--color-text-secondary)]" />
      <Space direction="vertical" size={4} className="w-full">
        <DatabaseOutlined style={{ fontSize: 24, color: tokens.color.primary }} />
        <Text strong className="!text-base">
          {d.label}
        </Text>
        <Text type="secondary" className="!text-xs block">
          {d.isExpanded ? "Tables shown →" : "Click to show tables & relations"}
        </Text>
      </Space>
    </div>
  );
}

export type TableNodeData = {
  label: string;
  tableName: string;
  schemaName: string | null;
  isColumnParent: boolean;
};

export function SchemaTableNode({ data }: NodeProps<Node<TableNodeData>>) {
  const d = data as unknown as TableNodeData;
  return (
    <div
      className="relative rounded-lg px-2 py-2"
      style={{
        background: "var(--color-surface-elevated)",
        minHeight: 72,
        pointerEvents: "all",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !bg-[var(--color-text-faint)]"
        id="t-in"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2"
        id="t-out"
        style={{ backgroundColor: tokens.color.primary }}
      />
      <Space direction="vertical" size={2} className="w-full text-left">
        <Space className="w-full" size={4}>
          <TableOutlined style={{ color: tokens.color.accent, fontSize: 16 }} />
          <Text strong className="!text-sm leading-tight line-clamp-2">
            {d.label}
          </Text>
        </Space>
        <Text type="secondary" className="!text-[10px]">
          {d.isColumnParent ? "Columns →" : "Click for columns in diagram"}
        </Text>
      </Space>
    </div>
  );
}

export type ColumnNodeData = {
  column: LiveColumn;
  tableKey: string;
  label: string;
  typeStr: string;
};

export function SchemaColumnNode({ data }: NodeProps<Node<ColumnNodeData>>) {
  const d = data as unknown as ColumnNodeData;
  const c = d.column;
  return (
    <div
      className="relative rounded-md px-1.5 py-0.5"
      style={{
        background: "var(--color-bg)",
        minWidth: 180,
        pointerEvents: "all",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-1.5 !w-1.5 !min-w-0 !border-0 !bg-[var(--color-text-faint)]"
        id="c-in"
      />
      <div className="flex items-center gap-1.5 pl-0.5">
        <ApiOutlined className="text-[10px] text-[var(--color-text-faint)]" />
        <Text className="!text-xs font-mono max-w-[88px] truncate" title={c.name}>
          {c.name}
        </Text>
        <Tag className="!m-0 !shrink-0 !text-[9px] !leading-[14px] !px-1 !py-0 max-w-[72px] truncate" title={d.typeStr}>
          {d.typeStr}
        </Tag>
        {c.is_pk && <Tag className="!m-0 !shrink-0 !text-[9px] !px-0.5" color="gold">PK</Tag>}
        {c.is_fk && <Tag className="!m-0 !shrink-0 !text-[9px] !px-0.5" color="purple">FK</Tag>}
      </div>
    </div>
  );
}

export const schemaEntityNodeTypes: NodeTypes = {
  schemaDatabase: SchemaDatabaseNode,
  schemaTable: SchemaTableNode,
  schemaColumn: SchemaColumnNode,
};
