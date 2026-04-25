import {
  ApiOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  KeyOutlined,
  LinkOutlined,
  NumberOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SyncOutlined,
  TableOutlined,
} from "@ant-design/icons";
import {
  App,
  AutoComplete,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Input,
  List,
  Progress,
  Row,
  Skeleton,
  Space,
  Spin,
  Tabs,
  Tag,
  Tree,
  Typography,
} from "antd";
import type { DataNode } from "antd/es/tree";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import StatCard from "@components/common/StatCard";
import { JsonView } from "@components/editors";
import { DataTable } from "@components/tables";
import PageHeader from "@components/common/PageHeader";
import ProjectPicker from "@components/common/ProjectPicker";
import SelectProjectHint from "@components/common/SelectProjectHint";

import useSelectedProject from "@hooks/useSelectedProject";
import { dataSourcesApi, type DataSource } from "@services/dataSourcesApi";
import {
  metadataApi,
  type MetadataColumn,
  type MetadataColumnHit,
  type MetadataSearchResults,
  type MetadataSummary,
  type MetadataTable,
} from "@services/metadataApi";
import { tokens } from "@theme/tokens";
import { getApiErrorMessage } from "@utils/apiErrors";

import { LiveSchemaExplorer } from "./LiveSchemaExplorer";

const { Text, Paragraph } = Typography;

const SOURCE_TYPE_COLOR: Record<string, string> = {
  MYSQL: "geekblue",
  POSTGRESQL: "blue",
  SNOWFLAKE: "cyan",
  BIGQUERY: "purple",
  API: "magenta",
};

const formatNumber = (value: number | null | undefined): string =>
  value == null ? "—" : value.toLocaleString();

const toQualityPercent = (value: number | string | null | undefined): number => {
  if (value == null) return 0;
  const numeric = typeof value === "string" ? Number.parseFloat(value) : value;
  if (Number.isNaN(numeric)) return 0;
  if (numeric <= 1) return Math.round(numeric * 100);
  return Math.min(100, Math.round(numeric));
};

const toNullPercent = (value: number | string | null | undefined): number => {
  if (value == null) return 0;
  const numeric = typeof value === "string" ? Number.parseFloat(value) : value;
  if (Number.isNaN(numeric)) return 0;
  if (numeric <= 1) return Math.round(numeric * 1000) / 10;
  return Math.min(100, Math.round(numeric * 10) / 10);
};

export const MetadataExplorerPage = () => {
  const { project, projectId } = useSelectedProject();
  const { message } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const [sources, setSources] = useState<DataSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  const [tables, setTables] = useState<MetadataTable[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tableQuery, setTableQuery] = useState("");

  const [summary, setSummary] = useState<MetadataSummary | null>(null);
  const [globalQuery, setGlobalQuery] = useState("");
  const [searchHits, setSearchHits] = useState<MetadataSearchResults>({
    tables: [],
    columns: [],
  });
  const searchDebounceRef = useRef<number | null>(null);

  const [drawer, setDrawer] = useState<{
    open: boolean;
    table?: MetadataTable;
    columns: MetadataColumn[];
    loading: boolean;
  }>({ open: false, columns: [], loading: false });
  const [selectedColumn, setSelectedColumn] = useState<MetadataColumn | null>(null);
  const [scanning, setScanning] = useState(false);
  const [exploreTab, setExploreTab] = useState<string>("list");
  const [metadataFullscreen, setMetadataFullscreen] = useState(false);
  const [schemaTreeData, setSchemaTreeData] = useState<DataNode[]>([]);
  const [schemaTreeLoading, setSchemaTreeLoading] = useState(false);

  const loadSources = useCallback(async (id: string) => {
    setSourcesLoading(true);
    try {
      const data = await dataSourcesApi.list(id);
      setSources(data);
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to load data sources"));
    } finally {
      setSourcesLoading(false);
    }
  }, [message]);

  const loadTables = useCallback(
    async (id: string) => {
      setTablesLoading(true);
      try {
        const data = await metadataApi.listTables(id);
        setTables(data);
      } catch (err) {
        message.error(getApiErrorMessage(err, "Failed to load tables"));
      } finally {
        setTablesLoading(false);
      }
    },
    [message],
  );

  const loadSummary = useCallback(async (id: string) => {
    try {
      const data = await metadataApi.getSummary(id);
      setSummary(data);
    } catch {
      setSummary(null);
    }
  }, []);

  const runGlobalSearch = useCallback(
    (id: string, query: string) => {
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current);
      }
      if (!query.trim()) {
        setSearchHits({ tables: [], columns: [] });
        return;
      }
      searchDebounceRef.current = window.setTimeout(async () => {
        try {
          const hits = await metadataApi.search(id, query, 30);
          setSearchHits(hits);
        } catch {
          setSearchHits({ tables: [], columns: [] });
        }
      }, 250);
    },
    [],
  );

  /** Same schema+table can appear more than once if metadata was scanned multiple times. */
  const tablesDeduped = useMemo(() => {
    const seen = new Set<string>();
    const out: MetadataTable[] = [];
    for (const t of tables) {
      const k = `${t.schema_name ?? ""}\u0000${t.table_name}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
    return out;
  }, [tables]);

  useEffect(() => {
    if (projectId) {
      setSelectedSourceId(null);
      setTables([]);
      void loadSources(projectId);
    } else {
      setSources([]);
      setTables([]);
      setSelectedSourceId(null);
    }
  }, [projectId, loadSources]);

  useEffect(() => {
    if (!metadataFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMetadataFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [metadataFullscreen]);

  useEffect(() => {
    if (!metadataFullscreen) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, [metadataFullscreen]);

  /**
   * Pick which connection is active: `?dataSource=<uuid>` (from Settings → Connections) wins,
   * otherwise keep a valid previous selection, otherwise the first source.
   */
  useEffect(() => {
    if (sources.length === 0) {
      setSelectedSourceId(null);
      return;
    }
    const fromUrl = searchParams.get("dataSource");
    if (fromUrl) {
      if (sources.some((s) => s.id === fromUrl)) {
        setSelectedSourceId(fromUrl);
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("dataSource");
            return next;
          },
          { replace: true },
        );
        return;
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("dataSource");
          return next;
        },
        { replace: true },
      );
    }
    setSelectedSourceId((prev) => {
      if (prev && sources.some((s) => s.id === prev)) return prev;
      return sources[0].id;
    });
  }, [sources, searchParams, setSearchParams]);

  useEffect(() => {
    if (selectedSourceId) {
      setExploreTab("list");
      void loadTables(selectedSourceId);
      void loadSummary(selectedSourceId);
      setGlobalQuery("");
      setSearchHits({ tables: [], columns: [] });
    } else {
      setTables([]);
      setSummary(null);
    }
  }, [selectedSourceId, loadTables, loadSummary]);

  useEffect(() => {
    if (selectedSourceId) {
      runGlobalSearch(selectedSourceId, globalQuery);
    }
  }, [selectedSourceId, globalQuery, runGlobalSearch]);

  useEffect(() => {
    if (exploreTab !== "tree" || !selectedSourceId || tablesDeduped.length === 0) {
      setSchemaTreeData([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setSchemaTreeLoading(true);
      try {
        const cap = Math.min(80, tablesDeduped.length);
        const slice = tablesDeduped.slice(0, cap);
        const colRows = await Promise.all(slice.map((t) => metadataApi.listColumns(t.id)));
        if (cancelled) return;
        setSchemaTreeData(
          slice.map((t, i) => ({
            key: `t-${t.id}`,
            title: (
              <Space>
                <TableOutlined />
                <Text strong>
                  {t.schema_name ? `${t.schema_name}.` : ""}
                  {t.table_name}
                </Text>
              </Space>
            ),
            children: colRows[i].map((c) => ({
              key: `c-${c.id}`,
              title: (
                <Space size={4} wrap>
                  <Text className="text-sm">{c.column_name}</Text>
                  {c.data_type && <Tag className="!text-xs">{String(c.data_type)}</Tag>}
                  {c.is_primary_key && <Tag color="gold">PK</Tag>}
                  {c.is_foreign_key && <Tag color="purple">FK</Tag>}
                </Space>
              ),
              isLeaf: true,
            })),
          })),
        );
      } catch {
        if (!cancelled) setSchemaTreeData([]);
      } finally {
        if (!cancelled) setSchemaTreeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exploreTab, selectedSourceId, tablesDeduped]);

  const onScanMetadata = async () => {
    if (!selectedSourceId) return;
    setScanning(true);
    try {
      await dataSourcesApi.scanMetadata(selectedSourceId);
      message.success("Metadata scan queued. Refresh in a moment.");
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to start metadata scan"));
    } finally {
      setScanning(false);
    }
  };

  const formatLargeNumber = (value: number | null | undefined): string => {
    if (value == null) return "—";
    if (value >= 1_000_000_000)
      return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toLocaleString();
  };

  const onPickSearchHit = useCallback(
    async (id: string, kind: "table" | "column") => {
      const tableId = kind === "table" ? id : searchHits.columns.find((c) => c.id === id)?.metadata_table_id;
      if (!tableId) return;
      const table = tables.find((t) => t.id === tableId);
      if (table) {
        await openTable(table);
      } else {
        try {
          const fetched = await metadataApi.getTable(tableId);
          await openTable(fetched);
        } catch (err) {
          message.error(getApiErrorMessage(err, "Failed to load table"));
        }
      }
      if (kind === "column") {
        try {
          const col = await metadataApi.getColumn(id);
          setSelectedColumn(col);
        } catch (err) {
          message.error(getApiErrorMessage(err, "Failed to load column"));
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchHits, tables, message],
  );

  const searchOptions = useMemo(() => {
    const options: { label: ReactNode; options: { value: string; label: ReactNode; data: { id: string; kind: "table" | "column" } }[] }[] = [];
    if (searchHits.tables.length > 0) {
      options.push({
        label: <Text strong>Tables</Text>,
        options: searchHits.tables.map((t) => ({
          value: `t:${t.id}`,
          label: (
            <Space>
              <TableOutlined />
              <Text strong>{t.table_name}</Text>
              {t.schema_name && <Tag>{t.schema_name}</Tag>}
            </Space>
          ),
          data: { id: t.id, kind: "table" as const },
        })),
      });
    }
    if (searchHits.columns.length > 0) {
      options.push({
        label: <Text strong>Columns</Text>,
        options: searchHits.columns.map((c: MetadataColumnHit) => ({
          value: `c:${c.id}`,
          label: (
            <Space>
              <ApiOutlined style={{ color: tokens.color.primary }} />
              <Text>{c.column_name}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                in {c.table_name}
              </Text>
              {c.data_type && <Tag color="blue">{c.data_type}</Tag>}
            </Space>
          ),
          data: { id: c.id, kind: "column" as const },
        })),
      });
    }
    return options;
  }, [searchHits]);

  const openTable = async (table: MetadataTable) => {
    setDrawer({ open: true, table, columns: [], loading: true });
    setSelectedColumn(null);
    try {
      const cols = await metadataApi.listColumns(table.id);
      setDrawer({ open: true, table, columns: cols, loading: false });
    } catch (err) {
      setDrawer({ open: true, table, columns: [], loading: false });
      message.error(getApiErrorMessage(err, "Failed to load columns"));
    }
  };

  const filteredTables = useMemo(() => {
    if (!tableQuery.trim()) return tablesDeduped;
    const needle = tableQuery.trim().toLowerCase();
    return tablesDeduped.filter((t) =>
      [t.table_name, t.schema_name, t.table_type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [tablesDeduped, tableQuery]);

  const tableColumns: ColumnsType<MetadataTable> = [
    {
      title: "Table",
      key: "table_name",
      render: (_, t) => (
        <Space size={8}>
          <TableOutlined style={{ color: tokens.color.primary }} />
          <Space direction="vertical" size={0}>
            <Text strong>{t.table_name}</Text>
            {t.schema_name && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t.schema_name}
              </Text>
            )}
          </Space>
        </Space>
      ),
      sorter: (a, b) => a.table_name.localeCompare(b.table_name),
    },
    {
      title: "Type",
      dataIndex: "table_type",
      width: 120,
      render: (v: string | null | undefined) =>
        v ? <Tag color="default">{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: "Rows",
      dataIndex: "row_count",
      width: 140,
      align: "right",
      render: (v: number | null | undefined) => formatNumber(v),
      sorter: (a, b) => (a.row_count ?? 0) - (b.row_count ?? 0),
    },
    {
      title: "Quality",
      dataIndex: "quality_score",
      width: 200,
      render: (v: number | string | null | undefined) => {
        const pct = toQualityPercent(v);
        if (v == null) return <Text type="secondary">—</Text>;
        return (
          <Progress
            percent={pct}
            size="small"
            status={pct >= 80 ? "success" : pct >= 50 ? "active" : "exception"}
          />
        );
      },
      sorter: (a, b) =>
        toQualityPercent(a.quality_score) - toQualityPercent(b.quality_score),
    },
    {
      title: "Last scanned",
      dataIndex: "last_scanned_at",
      width: 180,
      render: (v: string | null | undefined) =>
        v ? new Date(v).toLocaleString() : <Text type="secondary">—</Text>,
    },
    {
      title: "",
      key: "open",
      width: 80,
      align: "right",
      render: (_, t) => (
        <Button type="link" onClick={() => openTable(t)}>
          Open
        </Button>
      ),
    },
  ];

  const columnTableColumns: ColumnsType<MetadataColumn> = [
    {
      title: "Column",
      key: "column_name",
      render: (_, c) => (
        <Space size={6}>
          {c.is_primary_key && (
            <Tag color="gold" icon={<KeyOutlined />}>
              PK
            </Tag>
          )}
          {c.is_foreign_key && (
            <Tag color="purple" icon={<LinkOutlined />}>
              FK
            </Tag>
          )}
          <Text strong>{c.column_name}</Text>
        </Space>
      ),
    },
    {
      title: "Type",
      dataIndex: "data_type",
      width: 140,
      render: (v: string | null | undefined) =>
        v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: "Nullable",
      dataIndex: "is_nullable",
      width: 100,
      render: (v: boolean | null | undefined) =>
        v == null ? "—" : v ? <Tag>Yes</Tag> : <Tag color="success">No</Tag>,
    },
    {
      title: "Distinct",
      dataIndex: "distinct_count",
      width: 120,
      align: "right",
      render: (v: number | null | undefined) => formatNumber(v),
    },
    {
      title: "Null %",
      dataIndex: "null_percentage",
      width: 160,
      render: (v: number | string | null | undefined) => {
        if (v == null) return <Text type="secondary">—</Text>;
        const pct = toNullPercent(v);
        return (
          <Progress
            percent={pct}
            size="small"
            status={pct > 50 ? "exception" : pct > 10 ? "active" : "success"}
            format={(p) => `${p}%`}
          />
        );
      },
    },
    {
      title: "",
      key: "open",
      width: 80,
      align: "right",
      render: (_, c) => (
        <Button type="link" onClick={() => setSelectedColumn(c)}>
          Detail
        </Button>
      ),
    },
  ];

  const selectedSource = sources.find((s) => s.id === selectedSourceId);

  return (
    <div>
      <PageHeader
        title="Metadata Explorer"
        subtitle="Discover what's in every connection — tables, columns, and the quality signals attached to them."
        actions={
          <Space>
            <ProjectPicker />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => projectId && loadSources(projectId)}
              loading={sourcesLoading}
              disabled={!projectId}
            >
              Refresh
            </Button>
          </Space>
        }
      />

      {!project && (
        <SelectProjectHint message="Select a project to browse its data catalog." />
      )}

      {selectedSourceId && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12} md={6}>
              <StatCard
                title="Tables"
                value={formatLargeNumber(summary?.table_count ?? 0)}
                icon={<TableOutlined />}
                accent={tokens.color.primary}
                hint={
                  summary?.column_count != null
                    ? `${formatLargeNumber(summary.column_count)} columns indexed`
                    : undefined
                }
              />
            </Col>
            <Col xs={12} md={6}>
              <StatCard
                title="Total rows"
                value={formatLargeNumber(summary?.total_rows ?? 0)}
                icon={<NumberOutlined />}
                accent={tokens.color.accent}
                hint="Sum across every scanned table"
              />
            </Col>
            <Col xs={12} md={6}>
              <StatCard
                title="Avg quality"
                value={
                  summary?.avg_quality_score != null
                    ? `${toQualityPercent(summary.avg_quality_score)}%`
                    : "—"
                }
                icon={<SafetyCertificateOutlined />}
                accent={tokens.color.success}
                hint="Lower means more nulls and uniqueness gaps"
              />
            </Col>
            <Col xs={12} md={6}>
              <StatCard
                title="Last scanned"
                value={
                  summary?.last_scanned_at
                    ? new Date(summary.last_scanned_at).toLocaleDateString()
                    : "—"
                }
                icon={<ClockCircleOutlined />}
                accent={tokens.color.warning}
                hint={
                  summary?.last_scanned_at
                    ? new Date(summary.last_scanned_at).toLocaleTimeString()
                    : "Never"
                }
              />
            </Col>
          </Row>

          <Card style={{ marginBottom: 16 }} styles={{ body: { padding: 16 } }}>
            <AutoComplete
              value={globalQuery}
              onChange={(value) => setGlobalQuery(value)}
              onSelect={(_value, option) => {
                const data = (option as { data?: { id: string; kind: "table" | "column" } })
                  .data;
                if (data) void onPickSearchHit(data.id, data.kind);
                setGlobalQuery("");
              }}
              options={searchOptions}
              style={{ width: "100%" }}
              popupMatchSelectWidth={520}
              notFoundContent={
                globalQuery.trim() ? (
                  <Text type="secondary">No matches yet. Try another keyword.</Text>
                ) : null
              }
            >
              <Input
                size="large"
                allowClear
                prefix={<SearchOutlined style={{ color: tokens.color.textFaint }} />}
                placeholder="Search every table and column in this connection…"
              />
            </AutoComplete>
          </Card>
        </>
      )}

      <div
        className={
          metadataFullscreen
            ? "fixed inset-0 z-[1000] flex flex-col gap-0 overflow-y-auto overflow-x-hidden bg-[var(--color-bg)] p-0 shadow-2xl md:gap-2 md:p-4"
            : undefined
        }
      >
        {metadataFullscreen && (
          <div className="sticky top-0 z-[1] flex shrink-0 items-center justify-between gap-2 border-0 border-b border-solid border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 md:px-0">
            <Space wrap>
              <TableOutlined style={{ color: tokens.color.primary }} />
              <Text strong>Metadata preview</Text>
              {selectedSource && (
                <Tag color={SOURCE_TYPE_COLOR[selectedSource.source_type] || "default"}>
                  {selectedSource.name}
                </Tag>
              )}
            </Space>
            <Space size="small" wrap>
              <Text type="secondary" className="!hidden sm:!inline text-xs">
                Press Esc to exit
              </Text>
              <Button
                type="primary"
                icon={<FullscreenExitOutlined />}
                onClick={() => setMetadataFullscreen(false)}
              >
                Exit
              </Button>
            </Space>
          </div>
        )}
        <Row
          gutter={[16, 16]}
          align="top"
          className={metadataFullscreen ? "min-h-0 flex-1" : undefined}
        >
          <Col xs={24} md={8} lg={6} className={metadataFullscreen ? "flex min-h-0 flex-col" : undefined}>
          <Card
            title={<Space><DatabaseOutlined />Connections</Space>}
            loading={sourcesLoading && sources.length === 0}
            extra={
              <Badge count={sources.length} showZero color={tokens.color.primary} />
            }
            styles={{ body: { padding: 0 } }}
          >
            {sources.length === 0 ? (
              <div style={{ padding: 24 }}>
                <Empty description="No data sources yet." />
              </div>
            ) : (
              <List
                dataSource={sources}
                renderItem={(s) => {
                  const active = s.id === selectedSourceId;
                  return (
                    <List.Item
                      onClick={() => setSelectedSourceId(s.id)}
                      style={{
                        cursor: "pointer",
                        padding: "12px 16px",
                        background: active ? "rgba(99,102,241,0.10)" : "transparent",
                        borderLeft: active
                          ? `3px solid ${tokens.color.primary}`
                          : "3px solid transparent",
                        transition: "all 200ms ease",
                      }}
                    >
                      <List.Item.Meta
                        title={
                          <Space style={{ width: "100%", justifyContent: "space-between" }}>
                            <Text strong>{s.name}</Text>
                            <Tag color={SOURCE_TYPE_COLOR[s.source_type] || "default"}>
                              {s.source_type}
                            </Tag>
                          </Space>
                        }
                        description={
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {s.host || "—"}
                            {s.database_name ? ` / ${s.database_name}` : ""}
                          </Text>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
          </Col>

          <Col
            xs={24}
            md={16}
            lg={18}
            className={metadataFullscreen ? "flex min-h-0 flex-1 flex-col" : undefined}
          >
          <Card
            className={
              metadataFullscreen
                ? "flex min-h-0 flex-1 flex-col [&_.ant-card-body]:flex [&_.ant-card-body]:min-h-0 [&_.ant-card-body]:flex-1 [&_.ant-card-body]:flex-col"
                : undefined
            }
            title={
              <Space wrap>
                <TableOutlined />
                Tables
                {selectedSource && (
                  <Tag color={SOURCE_TYPE_COLOR[selectedSource.source_type] || "default"}>
                    {selectedSource.name}
                  </Tag>
                )}
              </Space>
            }
            extra={
              <Space>
                <Input.Search
                  placeholder="Search tables…"
                  allowClear
                  onChange={(e) => setTableQuery(e.target.value)}
                  style={{ width: 220 }}
                />
                {selectedSourceId && (
                  <Button
                    icon={
                      metadataFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />
                    }
                    onClick={() => setMetadataFullscreen((v) => !v)}
                  >
                    {metadataFullscreen ? "Exit full screen" : "Full screen"}
                  </Button>
                )}
                <Button
                  icon={<SyncOutlined />}
                  loading={scanning}
                  disabled={!selectedSourceId}
                  onClick={onScanMetadata}
                >
                  Scan metadata
                </Button>
              </Space>
            }
          >
            {!selectedSourceId ? (
              <Empty description="Select a connection to browse its tables." />
            ) : (
              <Tabs
                activeKey={exploreTab}
                onChange={setExploreTab}
                className={
                  metadataFullscreen
                    ? "metadata-explorer-fullscreen-tabs flex min-h-0 flex-1 flex-col [&_.ant-tabs-content-outer]:min-h-0 [&_.ant-tabs-content-outer]:flex-1"
                    : undefined
                }
                items={[
                  {
                    key: "list",
                    label: "Table list",
                    children: (
                      <div
                        className={metadataFullscreen ? "max-h-[min(80vh,920px)] overflow-auto" : undefined}
                      >
                        <DataTable<MetadataTable>
                          data={filteredTables}
                          columns={tableColumns}
                          rowKey="id"
                          loading={tablesLoading}
                          emptyDescription="No tables yet — run a metadata scan to populate the catalog."
                          pagination={{ pageSize: 20, showSizeChanger: true }}
                        />
                      </div>
                    ),
                  },
                  {
                    key: "tree",
                    label: "Tree (schema → table → column)",
                    children: schemaTreeLoading ? (
                      <div className="flex justify-center py-12">
                        <Spin size="large" />
                      </div>
                    ) : schemaTreeData.length === 0 ? (
                      <Empty description="No data to show. Run Scan, or switch to Table list." />
                    ) : (
                      <div
                        className={`overflow-auto rounded-lg border border-solid border-[var(--color-border)] p-2 ${
                          metadataFullscreen
                            ? "max-h-[min(80vh,960px)] min-h-[min(50vh,480px)]"
                            : "max-h-[min(70vh,720px)]"
                        }`}
                      >
                        <Tree
                          showLine
                          defaultExpandAll
                          treeData={schemaTreeData}
                        />
                      </div>
                    ),
                  },
                  {
                    key: "live",
                    label: "Live tree & ER",
                    children: selectedSource ? (
                      <LiveSchemaExplorer
                        dataSource={selectedSource}
                        viewMode={metadataFullscreen ? "expanded" : "default"}
                      />
                    ) : null,
                  },
                  {
                    key: "map",
                    label: "Schema map",
                    children: (
                      <div
                        className={metadataFullscreen ? "max-h-[min(82vh,920px)] overflow-y-auto" : undefined}
                      >
                        <div className="text-secondary mb-3 text-sm">
                          Entity-style grid: each box is a table (like an ER sheet). Click a card to open column details.
                        </div>
                        <Row gutter={[12, 12]}>
                          {filteredTables.map((t) => (
                            <Col xs={24} sm={12} lg={8} key={t.id}>
                              <Card
                                size="small"
                                hoverable
                                onClick={() => void openTable(t)}
                                title={
                                  <Space direction="vertical" size={0}>
                                    <Text strong>{t.table_name}</Text>
                                    {t.schema_name && (
                                      <Text type="secondary" className="!text-xs">
                                        {t.schema_name}
                                      </Text>
                                    )}
                                  </Space>
                                }
                              >
                                <Text type="secondary" className="!text-xs">
                                  {t.table_type || "TABLE"} · rows {formatNumber(t.row_count)}
                                </Text>
                              </Card>
                            </Col>
                          ))}
                        </Row>
                      </div>
                    ),
                  },
                ]}
              />
            )}
          </Card>
          </Col>
        </Row>
      </div>

      <Drawer
        title={
          drawer.table ? (
            <Space>
              <TableOutlined />
              <Text strong>{drawer.table.table_name}</Text>
              {drawer.table.schema_name && (
                <Tag color="default">{drawer.table.schema_name}</Tag>
              )}
            </Space>
          ) : (
            "Table details"
          )
        }
        open={drawer.open}
        onClose={() => setDrawer({ open: false, columns: [], loading: false })}
        width={metadataFullscreen ? "min(96vw, 1200px)" : 780}
        zIndex={metadataFullscreen ? 1100 : undefined}
        destroyOnHidden
      >
        {drawer.table && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Type">
                {drawer.table.table_type || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Rows">
                {formatNumber(drawer.table.row_count)}
              </Descriptions.Item>
              <Descriptions.Item label="Last scanned">
                {drawer.table.last_scanned_at
                  ? new Date(drawer.table.last_scanned_at).toLocaleString()
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Quality score">
                <Progress
                  percent={toQualityPercent(drawer.table.quality_score)}
                  size="small"
                  status={
                    toQualityPercent(drawer.table.quality_score) >= 80
                      ? "success"
                      : "active"
                  }
                />
              </Descriptions.Item>
            </Descriptions>

            <Card
              size="small"
              title={
                <Space>
                  <ApiOutlined />
                  Columns
                  <Badge count={drawer.columns.length} showZero color={tokens.color.primary} />
                </Space>
              }
              styles={{ body: { padding: 0 } }}
            >
              {drawer.loading ? (
                <div style={{ padding: 16 }}>
                  <Skeleton active />
                </div>
              ) : (
                <DataTable<MetadataColumn>
                  data={drawer.columns}
                  columns={columnTableColumns}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 10 }}
                  emptyDescription="No columns indexed yet."
                />
              )}
            </Card>
          </Space>
        )}
      </Drawer>

      <Drawer
        title={
          selectedColumn ? (
            <Space>
              <Text strong>{selectedColumn.column_name}</Text>
              {selectedColumn.is_primary_key && (
                <Tag color="gold" icon={<KeyOutlined />}>
                  PK
                </Tag>
              )}
              {selectedColumn.is_foreign_key && (
                <Tag color="purple" icon={<LinkOutlined />}>
                  FK
                </Tag>
              )}
            </Space>
          ) : (
            "Column details"
          )
        }
        open={!!selectedColumn}
        onClose={() => setSelectedColumn(null)}
        width={metadataFullscreen ? "min(90vw, 720px)" : 520}
        zIndex={metadataFullscreen ? 1100 : undefined}
        destroyOnHidden
      >
        {selectedColumn ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Data type">
                {selectedColumn.data_type || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Nullable">
                {selectedColumn.is_nullable == null
                  ? "—"
                  : selectedColumn.is_nullable
                    ? "Yes"
                    : "No"}
              </Descriptions.Item>
              <Descriptions.Item label="Distinct count">
                {formatNumber(selectedColumn.distinct_count)}
              </Descriptions.Item>
              <Descriptions.Item label="Null count">
                {formatNumber(selectedColumn.null_count)}
              </Descriptions.Item>
              <Descriptions.Item label="Null percentage">
                <Progress
                  percent={toNullPercent(selectedColumn.null_percentage)}
                  size="small"
                  status={
                    toNullPercent(selectedColumn.null_percentage) > 50
                      ? "exception"
                      : "active"
                  }
                  format={(p) => `${p}%`}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Min value">
                {selectedColumn.min_value || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Max value">
                {selectedColumn.max_value || "—"}
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title="Sample values" styles={{ body: { padding: 12 } }}>
              {selectedColumn.sample_values && selectedColumn.sample_values.length > 0 ? (
                <Space wrap>
                  {selectedColumn.sample_values.slice(0, 12).map((sample, idx) => (
                    <Tag key={idx} color="default" style={{ fontFamily: "monospace" }}>
                      {String(sample)}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Paragraph type="secondary" style={{ margin: 0 }}>
                  No sample values captured yet.
                </Paragraph>
              )}
            </Card>

            <JsonView value={selectedColumn} title="Raw column metadata" />
          </Space>
        ) : null}
      </Drawer>
    </div>
  );
};

export default MetadataExplorerPage;
