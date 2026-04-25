import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Empty, Input, Space, Table, Typography } from "antd";
import type { TableProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState, type ReactNode } from "react";

import { tokens } from "@theme/tokens";

const { Text } = Typography;

type Props<T> = Omit<TableProps<T>, "columns" | "dataSource" | "rowKey"> & {
  data: T[];
  columns: ColumnsType<T>;
  rowKey: keyof T | ((record: T) => string);
  /** Strip header above the table. */
  toolbar?: ReactNode;
  /** Show a search box that filters rows whose stringified values match the query. */
  searchable?: boolean;
  /** Placeholder for the search input. */
  searchPlaceholder?: string;
  /** Refresh button handler — hidden when omitted. */
  onRefresh?: () => void;
  /** Empty state message. */
  emptyDescription?: ReactNode;
};

/**
 * Generic, typed wrapper around `<Table />` that bakes in our default
 * pagination, an optional client-side search box, a refresh button and
 * a consistent empty state.
 *
 * Use this instead of touching `<Table>` directly whenever you can — it
 * keeps the table look consistent across Executions, Reports, Schedules,
 * Operations, Audit Logs, etc.
 *
 * @example
 *   <DataTable<RunRow>
 *     data={runs}
 *     columns={runColumns}
 *     rowKey="id"
 *     searchable
 *     onRefresh={refetch}
 *   />
 */
export function DataTable<T extends object>({
  data,
  columns,
  rowKey,
  toolbar,
  searchable,
  searchPlaceholder = "Search…",
  onRefresh,
  emptyDescription = "No records yet.",
  pagination,
  size = "middle",
  ...rest
}: Props<T>) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return data;
    const needle = query.trim().toLowerCase();
    return data.filter((row) =>
      Object.values(row as Record<string, unknown>).some((value) => {
        if (value == null) return false;
        if (typeof value === "string") return value.toLowerCase().includes(needle);
        if (typeof value === "number" || typeof value === "boolean")
          return String(value).includes(needle);
        return JSON.stringify(value).toLowerCase().includes(needle);
      }),
    );
  }, [data, query, searchable]);

  const showHeader = Boolean(toolbar || searchable || onRefresh);

  return (
    <div>
      {showHeader && (
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <Space size={8} wrap>
            {toolbar}
          </Space>
          <Space size={8}>
            {searchable && (
              <Input
                allowClear
                size="middle"
                placeholder={searchPlaceholder}
                prefix={<SearchOutlined style={{ color: tokens.color.textFaint }} />}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ width: 240 }}
              />
            )}
            {onRefresh && (
              <Button icon={<ReloadOutlined />} onClick={onRefresh}>
                Refresh
              </Button>
            )}
          </Space>
        </div>
      )}

      <Table<T>
        rowKey={rowKey as TableProps<T>["rowKey"]}
        size={size}
        dataSource={filtered}
        columns={columns}
        pagination={
          pagination === false
            ? false
            : {
                pageSize: 20,
                showSizeChanger: true,
                pageSizeOptions: ["10", "20", "50", "100"],
                showTotal: (total) => <Text type="secondary">{total} record(s)</Text>,
                ...pagination,
              }
        }
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={emptyDescription}
            />
          ),
        }}
        {...rest}
      />
    </div>
  );
}

export default DataTable;
