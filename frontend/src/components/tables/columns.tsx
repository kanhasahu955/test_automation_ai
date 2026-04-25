import { Tag, Tooltip, Typography } from "antd";
import type { ColumnType } from "antd/es/table";

import { executionStatusColor, type ExecutionStatus } from "@utils/executionStatus";

const { Text } = Typography;

const fmtDate = (iso?: string | null): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const relTime = (iso?: string | null): string => {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return iso;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86_400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86_400)}d ago`;
};

/**
 * Column factory: short ID with an explicit copy hint via Tooltip.
 *
 * Example: ``a3b1f9c2…`` instead of bleeding 36 chars across every row.
 */
export function idColumn<T>(opts: {
  title?: string;
  dataIndex: keyof T;
  width?: number;
}): ColumnType<T> {
  return {
    title: opts.title ?? "ID",
    dataIndex: opts.dataIndex as string,
    key: String(opts.dataIndex),
    width: opts.width ?? 120,
    render: (id: string) =>
      id ? (
        <Tooltip title={id}>
          <Text code style={{ fontSize: 12 }}>
            {id.slice(0, 8)}…
          </Text>
        </Tooltip>
      ) : (
        <Text type="secondary">—</Text>
      ),
  };
}

/**
 * Column factory: status pill that uses the project's execution-status palette.
 */
export function statusColumn<T>(opts: {
  title?: string;
  dataIndex: keyof T;
  width?: number;
}): ColumnType<T> {
  return {
    title: opts.title ?? "Status",
    dataIndex: opts.dataIndex as string,
    key: String(opts.dataIndex),
    width: opts.width ?? 130,
    render: (status: ExecutionStatus) =>
      status ? (
        <Tag color={executionStatusColor(status)} style={{ textTransform: "uppercase", margin: 0 }}>
          {status}
        </Tag>
      ) : (
        <Text type="secondary">—</Text>
      ),
  };
}

/**
 * Column factory: ISO datetime with absolute + relative tooltip.
 */
export function dateColumn<T>(opts: {
  title?: string;
  dataIndex: keyof T;
  width?: number;
  /** Show relative time as the cell text (absolute in tooltip) instead. */
  relative?: boolean;
}): ColumnType<T> {
  return {
    title: opts.title ?? "When",
    dataIndex: opts.dataIndex as string,
    key: String(opts.dataIndex),
    width: opts.width ?? 180,
    render: (iso?: string | null) =>
      iso ? (
        <Tooltip title={opts.relative ? fmtDate(iso) : relTime(iso)}>
          <Text>{opts.relative ? relTime(iso) : fmtDate(iso)}</Text>
        </Tooltip>
      ) : (
        <Text type="secondary">—</Text>
      ),
  };
}

/**
 * Column factory: numeric column right-aligned with thousands separators.
 */
export function numberColumn<T>(opts: {
  title: string;
  dataIndex: keyof T;
  width?: number;
}): ColumnType<T> {
  return {
    title: opts.title,
    dataIndex: opts.dataIndex as string,
    key: String(opts.dataIndex),
    width: opts.width ?? 120,
    align: "right",
    render: (n?: number | null) =>
      n == null ? <Text type="secondary">—</Text> : <Text>{n.toLocaleString()}</Text>,
  };
}

/**
 * Column factory: tag list rendered as a horizontally-scrollable strip.
 */
export function tagsColumn<T>(opts: {
  title: string;
  dataIndex: keyof T;
  color?: string;
}): ColumnType<T> {
  return {
    title: opts.title,
    dataIndex: opts.dataIndex as string,
    key: String(opts.dataIndex),
    render: (items?: string[] | null) =>
      !items || items.length === 0 ? (
        <Text type="secondary">—</Text>
      ) : (
        <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
          {items.map((v) => (
            <Tag key={v} color={opts.color ?? "default"}>
              {v}
            </Tag>
          ))}
        </span>
      ),
  };
}
