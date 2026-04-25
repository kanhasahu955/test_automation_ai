import {
  ApiOutlined,
  CodeOutlined,
  ConsoleSqlOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Space, Tag, Typography } from "antd";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ReactNode } from "react";

import { tokens } from "@theme/tokens";

const { Text } = Typography;

export type StepNodeKind = "ui" | "api" | "sql" | "ai" | "default";

export type StepNodeData = {
  /** Human-readable step name shown as the title. */
  label: string;
  /** Step type slug stored on the DSL — e.g. "navigate", "execute_sql". */
  stepType: string;
  /** Visual category — picks an icon + accent color. */
  kind?: StepNodeKind;
  /** Free-form params; we render up to 3 as inline chips. */
  params?: Record<string, unknown>;
  /** Optional last-run status to hint failures inline. */
  status?: "PASSED" | "FAILED" | "RUNNING" | "PENDING";
};

const KIND_META: Record<StepNodeKind, { color: string; icon: ReactNode }> = {
  ui: { color: tokens.color.primary, icon: <CodeOutlined /> },
  api: { color: tokens.color.accent, icon: <ApiOutlined /> },
  sql: { color: tokens.color.violet, icon: <ConsoleSqlOutlined /> },
  ai: { color: tokens.color.warning, icon: <ThunderboltOutlined /> },
  default: { color: tokens.color.textFaint, icon: <CodeOutlined /> },
};

const STATUS_COLOR: Record<NonNullable<StepNodeData["status"]>, string> = {
  PASSED: "success",
  FAILED: "error",
  RUNNING: "processing",
  PENDING: "default",
};

const previewParam = (value: unknown): string => {
  if (value == null) return "—";
  if (typeof value === "string") return value.length > 28 ? `${value.slice(0, 28)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    const json = JSON.stringify(value);
    return json.length > 28 ? `${json.slice(0, 28)}…` : json;
  } catch {
    return String(value);
  }
};

/**
 * Custom node renderer for the no-code flow designer.
 *
 * Replaces React Flow's default rectangle with a card that surfaces:
 *   - a colored gutter that hints the runtime (UI / API / SQL / AI)
 *   - the step label and step-type badge
 *   - up to 3 param chips so the canvas tells a story without opening the inspector
 *   - last-run status pill, when known
 */
export const StepNode = ({ data, selected }: NodeProps & { data: StepNodeData }) => {
  const meta = KIND_META[data.kind ?? "default"];
  const paramEntries = Object.entries(data.params ?? {}).slice(0, 3);

  return (
    <div
      style={{
        minWidth: 220,
        background: tokens.color.surface,
        borderRadius: tokens.radius.md,
        border: `2px solid ${selected ? meta.color : tokens.color.border}`,
        boxShadow: selected ? tokens.shadow.md : tokens.shadow.xs,
        overflow: "hidden",
        transition: "box-shadow 120ms ease, border-color 120ms ease",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: meta.color, width: 8, height: 8 }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          background: `${meta.color}14`,
          borderBottom: `1px solid ${tokens.color.border}`,
          color: meta.color,
          fontWeight: 600,
        }}
      >
        <span aria-hidden style={{ display: "flex" }}>
          {meta.icon}
        </span>
        <Text strong style={{ fontSize: 13 }}>
          {data.label || data.stepType}
        </Text>
        {data.status && (
          <Tag
            color={STATUS_COLOR[data.status]}
            style={{ marginLeft: "auto", textTransform: "uppercase" }}
          >
            {data.status}
          </Tag>
        )}
      </div>
      <div style={{ padding: 10 }}>
        <Tag color="default" style={{ marginBottom: 6, fontFamily: "monospace" }}>
          {data.stepType}
        </Tag>
        {paramEntries.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            No parameters yet — open the inspector to configure.
          </Text>
        ) : (
          <Space direction="vertical" size={4} style={{ width: "100%" }}>
            {paramEntries.map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  gap: 8,
                }}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {k}
                </Text>
                <Text style={{ fontSize: 12 }}>{previewParam(v)}</Text>
              </div>
            ))}
          </Space>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: meta.color, width: 8, height: 8 }}
      />
    </div>
  );
};

export default StepNode;
