import { DatabaseOutlined, TableOutlined, ApiOutlined, PartitionOutlined } from "@ant-design/icons";
import { App, Card, Col, Descriptions, Drawer, Empty, Row, Select, Space, Spin, Tag, Tree, Typography } from "antd";
import type { DataNode, EventDataNode } from "antd/es/tree";
import { ReactFlowProvider } from "@xyflow/react";
import { useCallback, useEffect, useState, type Key } from "react";

import { SchemaFlowCanvas } from "./schemaFlow/SchemaFlowCanvas";
import {
  DB_NODE_ID,
  buildColumnNodeId,
  buildTableNodeId,
  dedupeLiveTables,
  decodeTableKey,
  decodeTableRef,
  encodeTableKey,
  encodeTableRef,
} from "./schemaFlow/schemaKeys";

import {
  dataSourcesApi,
  type DataSource,
  type LiveColumn,
  type LiveForeignKeyEdge,
  type LiveTable,
} from "@services/dataSourcesApi";
import { tokens } from "@theme/tokens";
import { getApiErrorMessage } from "@utils/apiErrors";

const { Text } = Typography;

const ROOT_DB_KEY = "live-db";

function setChildrenByKey(list: DataNode[], target: Key, children: DataNode[]): DataNode[] {
  return list.map((node) => {
    if (node.key === target) return { ...node, children };
    if (node.children?.length) {
      return { ...node, children: setChildrenByKey(node.children, target, children) };
    }
    return node;
  });
}

type ErPayload = { tables: LiveTable[]; relations: LiveForeignKeyEdge[]; database: string };

type Props = {
  dataSource: DataSource;
  /** Taller tree + React Flow for full-screen metadata mode */
  viewMode?: "default" | "expanded";
};

export const LiveSchemaExplorer = ({ dataSource, viewMode = "default" }: Props) => {
  const { message } = App.useApp();
  const supported = dataSource.source_type === "MYSQL" || dataSource.source_type === "POSTGRESQL";

  const [dbs, setDbs] = useState<string[]>([]);
  const [dbsLoading, setDbsLoading] = useState(false);
  const [selectedDb, setSelectedDb] = useState<string | null>(null);

  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [erPayload, setErPayload] = useState<ErPayload | null>(null);
  const [erLoading, setErLoading] = useState(false);
  const [colDrawer, setColDrawer] = useState<{
    table: { schema: string | null; table: string } | null;
    column: LiveColumn | null;
  }>({ table: null, column: null });

  const [flowDbExpanded, setFlowDbExpanded] = useState(false);
  const [flowTableColumnKey, setFlowTableColumnKey] = useState<string | null>(null);
  const [flowColumnsByKey, setFlowColumnsByKey] = useState<Record<string, LiveColumn[]>>({});
  const [flowSelectedId, setFlowSelectedId] = useState<string | null>(null);
  const [flowFocusKey, setFlowFocusKey] = useState(0);

  const syncFlowToTable = useCallback(
    async (schema: string | null, table: string, opts?: { focus?: boolean }) => {
      if (!selectedDb) return;
      const tkey = encodeTableKey(schema, table);
      setFlowDbExpanded(true);
      setFlowTableColumnKey(tkey);
      setFlowSelectedId(buildTableNodeId(schema, table));
      if (opts?.focus) setFlowFocusKey((k) => k + 1);
      try {
        const { columns } = await dataSourcesApi.liveColumns(dataSource.id, {
          database: selectedDb,
          table,
          schema: dataSource.source_type === "POSTGRESQL" ? schema : null,
        });
        setFlowColumnsByKey((prev) => ({ ...prev, [tkey]: columns }));
      } catch (err) {
        message.error(getApiErrorMessage(err, "Failed to load columns"));
      }
    },
    [dataSource.id, dataSource.source_type, message, selectedDb],
  );

  const handleFlowDatabaseClick = useCallback(() => {
    setFlowDbExpanded((prev) => {
      if (prev) setFlowTableColumnKey(null);
      return !prev;
    });
    setFlowSelectedId(DB_NODE_ID);
    setFlowFocusKey((k) => k + 1);
  }, []);

  const handleFlowTableClick = useCallback(
    (schema: string | null, table: string, tkey: string) => {
      if (flowTableColumnKey === tkey) {
        setFlowTableColumnKey(null);
        setFlowSelectedId(buildTableNodeId(schema, table));
        setFlowFocusKey((k) => k + 1);
        return;
      }
      void syncFlowToTable(schema, table, { focus: true });
    },
    [flowTableColumnKey, syncFlowToTable],
  );

  const handleFlowColumnClick = useCallback((tableKey: string, _colName: string, col: LiveColumn) => {
    const tref = decodeTableKey(tableKey);
    if (tref) setColDrawer({ table: tref, column: col });
  }, []);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    (async () => {
      setDbsLoading(true);
      try {
        const { databases } = await dataSourcesApi.listDatabases(dataSource.id);
        if (cancelled) return;
        setDbs(databases);
        const prefer = (dataSource.database_name || "").trim();
        if (prefer && databases.includes(prefer)) {
          setSelectedDb(prefer);
        } else {
          setSelectedDb(databases[0] ?? null);
        }
      } catch (err) {
        if (!cancelled) message.error(getApiErrorMessage(err, "Failed to list databases"));
      } finally {
        if (!cancelled) setDbsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataSource.id, dataSource.database_name, message, supported]);

  useEffect(() => {
    if (!selectedDb || !supported) {
      setTreeData([]);
      setErPayload(null);
      return;
    }
    setFlowDbExpanded(false);
    setFlowTableColumnKey(null);
    setFlowColumnsByKey({});
    setFlowSelectedId(null);
    setFlowFocusKey(0);
    setColDrawer({ table: null, column: null });
    setTreeData([
      {
        key: ROOT_DB_KEY,
        title: (
          <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1">
            <DatabaseOutlined className="shrink-0" style={{ color: tokens.color.primary }} />
            <span className="min-w-0 break-words font-semibold text-[15px] leading-snug text-[var(--color-ink)]">
              {selectedDb}
            </span>
            <Tag color="blue" className="!m-0">
              expand to load tables
            </Tag>
          </span>
        ),
        isLeaf: false,
        children: undefined,
      },
    ]);
  }, [selectedDb, supported]);

  const loadEr = useCallback(
    async (db: string) => {
      setErPayload(null);
      setErLoading(true);
      try {
        const [tRes, rRes] = await Promise.all([
          dataSourcesApi.liveTables(dataSource.id, db),
          dataSourcesApi.liveRelations(dataSource.id, db),
        ]);
        setErPayload({
          database: db,
          tables: dedupeLiveTables(tRes.tables),
          relations: rRes.relations,
        });
      } catch (err) {
        setErPayload(null);
        message.error(getApiErrorMessage(err, "Failed to load relationship map"));
      } finally {
        setErLoading(false);
      }
    },
    [dataSource.id, message],
  );

  useEffect(() => {
    if (!selectedDb || !supported) {
      setErPayload(null);
      setErLoading(false);
      return;
    }
    void loadEr(selectedDb);
  }, [selectedDb, supported, loadEr]);

  useEffect(() => {
    if (!erPayload) return;
    setFlowDbExpanded(false);
    setFlowTableColumnKey(null);
    setFlowColumnsByKey({});
    setFlowSelectedId(DB_NODE_ID);
    setFlowFocusKey((k) => k + 1);
  }, [erPayload]);

  const onLoadData = (node: EventDataNode<DataNode>) =>
    new Promise<void>((resolve, reject) => {
      (async () => {
        if (!selectedDb) {
          resolve();
          return;
        }
        if (node.key === ROOT_DB_KEY) {
          try {
            const { tables: rawTables } = await dataSourcesApi.liveTables(dataSource.id, selectedDb);
            const tables = dedupeLiveTables(rawTables);
            setTreeData((prev) =>
              setChildrenByKey(
                prev,
                ROOT_DB_KEY,
                tables.map((t) => ({
                  key: encodeTableRef(t.schema_name, t.table_name),
                  title: (
                    <span className="inline-flex min-w-0 max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                      <TableOutlined className="shrink-0" style={{ color: tokens.color.accent }} />
                      <span className="min-w-0 break-words text-[14px] leading-snug text-[var(--color-ink)]">
                        {t.schema_name ? `${t.schema_name}.` : null}
                        {t.table_name}
                      </span>
                    </span>
                  ),
                  isLeaf: false,
                  children: undefined,
                })),
              ),
            );
            resolve();
          } catch (err) {
            message.error(getApiErrorMessage(err, "Failed to load tables"));
            reject(err);
          }
          return;
        }
        const ref = decodeTableRef(String(node.key));
        if (ref) {
          try {
            const { columns } = await dataSourcesApi.liveColumns(dataSource.id, {
              database: selectedDb,
              table: ref.table,
              schema: dataSource.source_type === "POSTGRESQL" ? ref.schema : null,
            });
            setTreeData((prev) =>
              setChildrenByKey(
                prev,
                node.key!,
                columns.map(
                  (c) =>
                    ({
                      key: `col:${String(node.key)}|${c.name}`,
                      title: (
                        <Space size={4} wrap>
                          <ApiOutlined className="text-xs text-[var(--color-text-secondary)]" />
                          <Text className="text-sm">{c.name}</Text>
                          <Tag className="!text-xs">{c.data_type}</Tag>
                          {c.is_pk && <Tag color="gold">PK</Tag>}
                          {c.is_fk && <Tag color="purple">FK</Tag>}
                        </Space>
                      ),
                      isLeaf: true,
                    }) as DataNode,
                ),
              ),
            );
            resolve();
          } catch (err) {
            message.error(getApiErrorMessage(err, "Failed to load columns"));
            reject(err);
          }
          return;
        }
        resolve();
      })();
    });

  const onTreeSelect = (_keys: Key[], info: { node: DataNode; selected: boolean }) => {
    if (!info.selected) return;
    const k = String(info.node.key);
    if (k.startsWith("col:")) {
      const rest = k.slice(4);
      const bar = rest.indexOf("|");
      if (bar === -1) return;
      const tableKey = rest.slice(0, bar);
      const colName = rest.slice(bar + 1);
      const tref = decodeTableRef(tableKey);
      if (!tref || !selectedDb) return;
      void (async () => {
        let cols = flowColumnsByKey[tableKey];
        if (!cols) {
          try {
            const { columns } = await dataSourcesApi.liveColumns(dataSource.id, {
              database: selectedDb,
              table: tref.table,
              schema: dataSource.source_type === "POSTGRESQL" ? tref.schema : null,
            });
            cols = columns;
            setFlowColumnsByKey((prev) => ({ ...prev, [tableKey]: columns }));
          } catch (err) {
            message.error(getApiErrorMessage(err, "Failed to open column details"));
            return;
          }
        }
        const col = cols.find((c) => c.name === colName) ?? null;
        setColDrawer({ table: tref, column: col });
        setFlowDbExpanded(true);
        setFlowTableColumnKey(tableKey);
        setFlowSelectedId(buildColumnNodeId(tableKey, colName));
        setFlowFocusKey((x) => x + 1);
      })();
      return;
    }
    if (k.startsWith("tbl:")) {
      const ref = decodeTableRef(k);
      if (!ref) return;
      void syncFlowToTable(ref.schema, ref.table, { focus: true });
      setColDrawer({ table: null, column: null });
      return;
    }
    setColDrawer({ table: null, column: null });
  };

  const isExpanded = viewMode === "expanded";
  const treeBodyStyle = isExpanded
    ? { maxHeight: "none" as const, height: "calc(100vh - 14rem)", overflow: "auto" as const, padding: "10px 6px" }
    : {
        minHeight: 400,
        maxHeight: "min(75vh,800px)",
        overflow: "auto" as const,
        padding: "10px 6px",
      };

  if (!supported) {
    return (
      <Empty description="Live schema tree and ER map are available for MySQL and PostgreSQL connections." />
    );
  }

  return (
    <div className={`flex w-full flex-col gap-4 ${isExpanded ? "min-h-0 flex-1" : ""}`}>
      <Row gutter={16}>
        <Col xs={24} md={10} lg={8}>
          <div className="text-secondary mb-2 text-sm">Database catalog</div>
          <Select
            showSearch
            className="w-full"
            options={dbs.map((d) => ({ value: d, label: d }))}
            value={selectedDb}
            onChange={(v) => {
              setSelectedDb(v);
              setErPayload(null);
            }}
            loading={dbsLoading}
            placeholder="Choose a database"
            allowClear={false}
          />
        </Col>
        <Col xs={24} md={14} lg={16}>
          <Text type="secondary" className="text-sm">
            Diagram: click the database node to show tables and foreign keys; click a table to show
            its columns as nodes; click a column for full details. The tree on the left mirrors this
            hierarchy.
          </Text>
        </Col>
      </Row>

      <Row
        gutter={[20, 20]}
        align="stretch"
        className={`min-h-0 w-full items-stretch ${isExpanded ? "min-h-0 flex-1" : "min-h-[min(640px,80vh)]"}`}
        wrap
      >
        <Col
          xs={24}
          lg={8}
          className={isExpanded ? "flex min-h-0 min-w-0 max-w-full flex-col lg:max-w-[480px]" : "min-w-0"}
        >
          <Card
            size="small"
            className={isExpanded ? "flex h-full min-h-0 flex-1 flex-col" : "h-full"}
            title={
              <Space>
                <PartitionOutlined style={{ color: tokens.color.primary }} />
                <span>Tree: database → table → column</span>
              </Space>
            }
            styles={{ body: treeBodyStyle }}
          >
            {!selectedDb ? (
              <Empty description="Pick a database first." image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : treeData.length === 0 ? (
              <Spin />
            ) : (
              <div className="w-full min-w-[min(100%,240px)] max-w-full">
                <Tree
                  showLine
                  blockNode
                  className="text-[15px] leading-7 [&_.ant-tree-treenode]:!items-start [&_.ant-tree-treenode]:!py-0.5 [&_.ant-tree-node-content-wrapper]:!min-w-0 [&_.ant-tree-node-content-wrapper]:!flex-1 [&_.ant-tree-title]:!min-w-0"
                  loadData={onLoadData}
                  treeData={treeData}
                  onSelect={onTreeSelect}
                />
              </div>
            )}
          </Card>
        </Col>
        <Col
          xs={24}
          lg={16}
          className={isExpanded ? "flex min-h-0 min-w-0 flex-1 flex-col" : "min-h-0 min-w-0 flex-1"}
        >
          <Card
            size="small"
            className={
              isExpanded
                ? "flex h-full min-h-0 min-w-0 flex-1 flex-col [&_.ant-card-body]:flex-1"
                : "flex h-full min-h-0 min-w-0 flex-1 flex-col [&_.ant-card-body]:!p-2 [&_.ant-card-body]:md:!p-3"
            }
            title={
              <Space wrap>
                <span>Hierarchical ER: database → tables → columns (click each level)</span>
                {erLoading && <Spin size="small" />}
              </Space>
            }
            styles={isExpanded ? { body: { display: "flex", flex: 1, flexDirection: "column", minHeight: 0 } } : { body: { minHeight: 0, flex: 1, display: "flex", flexDirection: "column" } }}
          >
            {!selectedDb ? (
              <Empty description="Select a database to load the relationship map." image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : !erPayload && !erLoading ? (
              <Text type="secondary" className="text-sm">
                No diagram data. Check your connection and database name.
              </Text>
            ) : !erPayload ? (
              <div className="flex min-h-[280px] flex-1 items-center justify-center">
                <Spin />
              </div>
            ) : (
              <div
                className={
                  isExpanded
                    ? "flex min-h-0 w-full min-w-0 flex-1 flex-col"
                    : "flex h-[min(72vh,900px)] min-h-[520px] w-full min-w-0 flex-1 flex-col"
                }
              >
                <ReactFlowProvider>
                  <SchemaFlowCanvas
                    payload={erPayload}
                    viewMode={isExpanded ? "expanded" : "default"}
                    dbExpanded={flowDbExpanded}
                    tableColumnKey={flowTableColumnKey}
                    columnsByTableKey={flowColumnsByKey}
                    selectedNodeId={flowSelectedId}
                    onSelectNode={setFlowSelectedId}
                    onDatabaseClick={handleFlowDatabaseClick}
                    onTableClick={handleFlowTableClick}
                    onColumnClick={handleFlowColumnClick}
                    onPaneClick={() => {
                      setFlowSelectedId(null);
                      setColDrawer({ table: null, column: null });
                    }}
                    focusKey={flowFocusKey}
                  />
                </ReactFlowProvider>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Drawer
        open={!!colDrawer.column && !!colDrawer.table}
        onClose={() => setColDrawer({ table: null, column: null })}
        zIndex={1100}
        width={isExpanded ? "min(92vw, 720px)" : 480}
        title={
          colDrawer.column ? (
            <Space>
              <Text strong>{colDrawer.column.name}</Text>
              {colDrawer.table && (
                <Text type="secondary" className="!text-sm">
                  {colDrawer.table.schema
                    ? `${colDrawer.table.schema}.${colDrawer.table.table}`
                    : colDrawer.table.table}
                </Text>
              )}
            </Space>
          ) : null
        }
        destroyOnHidden
      >
        {colDrawer.column && colDrawer.table && (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Type">{colDrawer.column.data_type || "—"}</Descriptions.Item>
            <Descriptions.Item label="Nullable">
              {colDrawer.column.nullable ? "Yes" : "No"}
            </Descriptions.Item>
            <Descriptions.Item label="Default">
              {colDrawer.column.default != null && colDrawer.column.default !== "" ? colDrawer.column.default : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Primary key">
              {colDrawer.column.is_pk ? "Yes" : "No"}
            </Descriptions.Item>
            <Descriptions.Item label="Foreign key">
              {colDrawer.column.is_fk ? "Yes" : "No"}
            </Descriptions.Item>
            {colDrawer.column.autoincrement != null && (
              <Descriptions.Item label="Autoincrement">
                {String(colDrawer.column.autoincrement)}
              </Descriptions.Item>
            )}
            {colDrawer.column.comment && (
              <Descriptions.Item label="Comment">{colDrawer.column.comment}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default LiveSchemaExplorer;
