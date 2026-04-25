import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SyncOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  App,
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ROUTES } from "@constants/routes";

import { useAppSelector } from "@app/store";
import { DataTable } from "@components/tables";
import ProjectPicker from "@components/common/ProjectPicker";
import useSelectedProject from "@hooks/useSelectedProject";
import {
  dataSourcesApi,
  type DataSource,
  type DataSourceCreateInput,
  type DataSourceType,
} from "@services/dataSourcesApi";
import { getApiErrorMessage } from "@utils/apiErrors";

const { Text, Paragraph } = Typography;

const SOURCE_TYPES: { value: DataSourceType; label: string; defaultPort: number | null }[] = [
  { value: "MYSQL", label: "MySQL", defaultPort: 3306 },
  { value: "POSTGRESQL", label: "PostgreSQL", defaultPort: 5432 },
  { value: "SNOWFLAKE", label: "Snowflake", defaultPort: 443 },
  { value: "BIGQUERY", label: "BigQuery", defaultPort: null },
  { value: "API", label: "Generic API", defaultPort: null },
];

const TYPE_COLOR: Record<DataSourceType, string> = {
  MYSQL: "geekblue",
  POSTGRESQL: "blue",
  SNOWFLAKE: "cyan",
  BIGQUERY: "purple",
  API: "magenta",
};

const isSqlDataSource = (t: DataSourceType) => t === "MYSQL" || t === "POSTGRESQL";

type ConnectionFormShape = DataSourceCreateInput & {
  /** UI-only: mapped to `extra_config.sslmode` for PostgreSQL. */
  ssl_mode?: string;
};

export const ConnectionsSection = () => {
  const { message } = App.useApp();
  const { project, projectId } = useSelectedProject();
  const role = useAppSelector((s) => s.auth.user?.role);
  const canMutate =
    role === "ADMIN" || role === "QA_MANAGER" || role === "DATA_ENGINEER";

  const [items, setItems] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<DataSource | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [form] = Form.useForm<ConnectionFormShape>();
  const sourceType = Form.useWatch("source_type", form);
  const [dbCatalog, setDbCatalog] = useState<string[]>([]);
  const [discover, setDiscover] = useState<{
    open: boolean;
    ds: DataSource | null;
    options: string[];
    value: string | null;
    loading: boolean;
  }>({ open: false, ds: null, options: [], value: null, loading: false });

  const load = useCallback(async () => {
    if (!projectId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const data = await dataSourcesApi.list(projectId);
      setItems(data);
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to load connections"));
    } finally {
      setLoading(false);
    }
  }, [message, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setDbCatalog([]);
    form.resetFields();
    form.setFieldsValue({
      source_type: "MYSQL",
      port: 3306,
      is_active: true,
      ssl_mode: "require",
    });
    setModalOpen(true);
  };

  const openEdit = (ds: DataSource) => {
    setEditing(ds);
    setDbCatalog([]);
    const pgSsl = (ds.extra_config as { sslmode?: string } | null | undefined)?.sslmode;
    form.setFieldsValue({
      name: ds.name,
      source_type: ds.source_type,
      host: ds.host,
      port: ds.port ?? null,
      database_name: ds.database_name,
      username: ds.username,
      password: "",
      is_active: ds.is_active,
      ssl_mode: pgSsl ?? (ds.source_type === "POSTGRESQL" ? "require" : undefined),
    });
    setModalOpen(true);
  };

  const onSubmit = async (values: ConnectionFormShape) => {
    if (!projectId) return;
    setSaving(true);
    try {
      const { ssl_mode, ...raw } = values;
      const cleanedPassword =
        typeof values.password === "string" ? values.password : null;
      const payload: DataSourceCreateInput = {
        ...raw,
        extra_config:
          values.source_type === "POSTGRESQL"
            ? { sslmode: ssl_mode ?? "require" }
            : null,
      };
      if (editing) {
        if (!cleanedPassword) {
          delete payload.password;
        }
        await dataSourcesApi.update(editing.id, payload);
        message.success("Connection updated.");
      } else {
        await dataSourcesApi.create(projectId, payload);
        message.success("Connection created.");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to save connection"));
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async (ds: DataSource) => {
    try {
      await dataSourcesApi.remove(ds.id);
      message.success(`Connection "${ds.name}" deleted.`);
      await load();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to delete connection"));
    }
  };

  const onTest = async (ds: DataSource) => {
    setTestingId(ds.id);
    try {
      const result = await dataSourcesApi.testConnection(ds.id);
      if (result.ok) message.success(`✓ ${result.message}`);
      else message.warning(`✗ ${result.message}`);
    } catch (err) {
      message.error(getApiErrorMessage(err, "Test connection failed"));
    } finally {
      setTestingId(null);
    }
  };

  const onScan = async (ds: DataSource) => {
    if (isSqlDataSource(ds.source_type) && !ds.database_name?.trim()) {
      message.warning("Select a target database (Pick database) before running Scan.");
      return;
    }
    setScanningId(ds.id);
    try {
      await dataSourcesApi.scanMetadata(ds.id);
      message.success("Metadata scan queued.");
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to queue metadata scan"));
    } finally {
      setScanningId(null);
    }
  };

  const openDiscover = async (ds: DataSource) => {
    setDiscover({
      open: true,
      ds,
      options: [],
      value: ds.database_name?.trim() || null,
      loading: true,
    });
    try {
      const { databases } = await dataSourcesApi.listDatabases(ds.id);
      setDiscover((d) => ({ ...d, options: databases, loading: false }));
    } catch (err) {
      message.error(getApiErrorMessage(err, "Could not list databases. Run Test first."));
      setDiscover({ open: false, ds: null, options: [], value: null, loading: false });
    }
  };

  const applyDiscover = async () => {
    if (!discover.ds || !discover.value) return;
    setDiscover((d) => ({ ...d, loading: true }));
    try {
      await dataSourcesApi.update(discover.ds.id, { database_name: discover.value });
      message.success("Database saved. You can run Scan, then open Metadata.");
      setDiscover({ open: false, ds: null, options: [], value: null, loading: false });
      await load();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to save database name"));
    } finally {
      setDiscover((d) => ({ ...d, loading: false }));
    }
  };

  const loadDbCatalogInForm = async () => {
    if (!editing) return;
    try {
      const { databases } = await dataSourcesApi.listDatabases(editing.id);
      setDbCatalog(databases);
      message.success(
        databases.length
          ? `Found ${databases.length} database(s) — pick one to fill the field, then Save.`
          : "No databases returned. Check user privileges.",
      );
    } catch (err) {
      message.error(getApiErrorMessage(err, "Load databases"));
    }
  };

  const columns: ColumnsType<DataSource> = [
    {
      title: "Name",
      dataIndex: "name",
      render: (_v, ds) => (
        <Space direction="vertical" size={0}>
          <Space size={6}>
            <DatabaseOutlined />
            <Text strong>{ds.name}</Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {ds.host || "—"}
            {ds.database_name ? ` / ${ds.database_name}` : ""}
          </Text>
        </Space>
      ),
    },
    {
      title: "Type",
      dataIndex: "source_type",
      width: 130,
      render: (v: DataSourceType) => <Tag color={TYPE_COLOR[v]}>{v}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "is_active",
      width: 110,
      render: (v: boolean) =>
        v ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            Active
          </Tag>
        ) : (
          <Tag color="default" icon={<CloseCircleOutlined />}>
            Disabled
          </Tag>
        ),
    },
    {
      title: "Created",
      dataIndex: "created_at",
      width: 180,
      render: (v?: string) => (v ? new Date(v).toLocaleString() : "—"),
    },
    {
      title: "",
      key: "actions",
      width: 400,
      align: "right",
      render: (_v, ds) => (
        <Space size={0} wrap className="justify-end">
          <Link to={`${ROUTES.METADATA}?dataSource=${ds.id}`}>
            <Button type="link" size="small" className="!px-1">
              Map schema
            </Button>
          </Link>
          {isSqlDataSource(ds.source_type) && (
            <Button
              type="text"
              size="small"
              onClick={() => void openDiscover(ds)}
              disabled={!canMutate}
            >
              Pick database
            </Button>
          )}
          <Button
            type="text"
            size="small"
            icon={<ThunderboltOutlined />}
            loading={testingId === ds.id}
            onClick={() => onTest(ds)}
            disabled={!canMutate}
          >
            Test
          </Button>
          <Tooltip
            title={
              isSqlDataSource(ds.source_type) && !ds.database_name?.trim()
                ? "Pick a database on the server first, then save."
                : ""
            }
          >
            <span>
              <Button
                type="text"
                size="small"
                icon={<SyncOutlined />}
                loading={scanningId === ds.id}
                onClick={() => onScan(ds)}
                disabled={!canMutate || (isSqlDataSource(ds.source_type) && !ds.database_name?.trim())}
              >
                Scan
              </Button>
            </span>
          </Tooltip>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(ds)}
            disabled={!canMutate}
          />
          <Popconfirm
            title={`Delete "${ds.name}"?`}
            okType="danger"
            okText="Delete"
            disabled={!canMutate}
            onConfirm={() => onRemove(ds)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} disabled={!canMutate} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <Text strong>Connections</Text>
          <Tag>{items.length}</Tag>
          {project && <Tag color="blue">{project.name}</Tag>}
        </Space>
      }
      extra={
        <Space>
          <ProjectPicker />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
            disabled={!canMutate || !projectId}
          >
            New connection
          </Button>
        </Space>
      }
    >
      {!projectId ? (
        <Empty description="Select a project to manage its connections." />
      ) : (
        <>
          <Alert
            type="info"
            showIcon
            className="mb-4"
            message="Connect a database, then map schema for quality rules and test design"
            description={
              <div className="text-sm">
                <ol className="mb-2 list-decimal pl-4">
                  <li>
                    Enter <strong>host</strong>, <strong>port</strong>, and <strong>credentials</strong> — <strong>database name is optional</strong> for
                    MySQL/Postgres. <strong>Test</strong> must succeed.
                  </li>
                  <li>
                    If you skipped the database name, use <strong>Pick database</strong> to select one from the server, then <strong>Scan</strong> (Celery worker
                    must be running).
                  </li>
                  <li>
                    Open <Link to={ROUTES.METADATA}>Metadata</Link> (tree or table view) to browse tables and columns.
                  </li>
                </ol>
                <Paragraph type="secondary" className="!mb-0 !text-sm">
                  <strong>MySQL (local):</strong> <code>127.0.0.1</code> or <code>localhost</code> when the API is on the host; use <code>host.docker.internal</code> if the API runs in Docker.
                </Paragraph>
                <Paragraph type="secondary" className="!mb-0 !mt-1 !text-sm">
                  <strong>Neon &amp; Supabase</strong> are PostgreSQL: choose type <strong>PostgreSQL</strong>, use the <strong>host</strong> from their dashboard (e.g. <code>ep-…-pooler.us-east-2.aws.neon.tech</code>), port <code>5432</code> (or the port they show), database name, user, and password. Set <strong>SSL mode</strong> to <code>require</code> (default for new Postgres connections).
                </Paragraph>
              </div>
            }
          />
        <DataTable<DataSource>
          rowKey="id"
          data={items}
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 10 }}
          emptyDescription="No connections yet."
        />
        </>
      )}

      <Modal
        title={editing ? `Edit "${editing.name}"` : "New connection"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={form.submit}
        confirmLoading={saving}
        okText={editing ? "Save" : "Create"}
        destroyOnHidden
        width={620}
      >
        <Form<ConnectionFormShape> form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, min: 1, max: 255 }]}
          >
            <Input placeholder="Reporting DB" />
          </Form.Item>
          <Form.Item label="Type" name="source_type" rules={[{ required: true }]}>
            <Select
              options={SOURCE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              onChange={(value: DataSourceType) => {
                const def = SOURCE_TYPES.find((t) => t.value === value);
                if (def) form.setFieldValue("port", def.defaultPort);
                if (value === "POSTGRESQL") {
                  form.setFieldValue("ssl_mode", form.getFieldValue("ssl_mode") || "require");
                }
              }}
            />
          </Form.Item>
          <Space.Compact style={{ width: "100%", display: "flex", gap: 12 }} block>
            <Form.Item
              label="Host"
              name="host"
              style={{ flex: 1 }}
              extra="Local: 127.0.0.1 — API in Docker: host.docker.internal or host LAN IP"
            >
              <Input placeholder="127.0.0.1 or host.docker.internal" />
            </Form.Item>
            <Form.Item label="Port" name="port" style={{ width: 140 }}>
              <InputNumber min={1} max={65535} style={{ width: "100%" }} />
            </Form.Item>
          </Space.Compact>
          <Form.Item
            label="Database name"
            name="database_name"
            extra="Optional for Test. MySQL/Postgres: run Test, then “Load from server” or use Pick database on the table row, then Save."
          >
            <Input placeholder="my_app_db" allowClear />
          </Form.Item>
          {editing && sourceType && isSqlDataSource(sourceType) && (
            <Form.Item label="Load from server">
              <Space wrap>
                <Button type="dashed" size="small" onClick={() => void loadDbCatalogInForm()}>
                  Load databases from server
                </Button>
                {dbCatalog.length > 0 && (
                  <Select
                    showSearch
                    placeholder="Select to fill database name"
                    style={{ minWidth: 220 }}
                    options={dbCatalog.map((d) => ({ value: d, label: d }))}
                    onChange={(v) => form.setFieldValue("database_name", v)}
                    allowClear
                  />
                )}
              </Space>
            </Form.Item>
          )}
          <Space.Compact style={{ width: "100%", display: "flex", gap: 12 }} block>
            <Form.Item label="Username" name="username" style={{ flex: 1 }}>
              <Input autoComplete="off" />
            </Form.Item>
            <Form.Item
              label={editing ? "Password (blank = keep)" : "Password"}
              name="password"
              style={{ flex: 1 }}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          </Space.Compact>
          {sourceType === "POSTGRESQL" && (
            <Form.Item
              label="SSL mode"
              name="ssl_mode"
              initialValue="require"
              extra="Cloud Postgres (Neon, Supabase) needs “require”. Use “disable” or “prefer” for local PostgreSQL only."
            >
              <Select
                options={[
                  { value: "require", label: "require (Neon, Supabase, most cloud DBs)" },
                  { value: "prefer", label: "prefer" },
                  { value: "allow", label: "allow" },
                  { value: "disable", label: "disable (local PostgreSQL, no SSL)" },
                ]}
              />
            </Form.Item>
          )}
          <Form.Item label="Active" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Pick target database"
        open={discover.open}
        onCancel={() => setDiscover({ open: false, ds: null, options: [], value: null, loading: false })}
        onOk={() => void applyDiscover()}
        confirmLoading={discover.loading}
        okText="Save"
        okButtonProps={{ disabled: !discover.value }}
        destroyOnClose
      >
        <Paragraph type="secondary" className="!mb-3">
          Run <strong>Test</strong> on this connection first. This lists MySQL/Postgres database names the user can see.
        </Paragraph>
        <Select
          showSearch
          className="!w-full"
          placeholder="Select a database"
          options={discover.options.map((d) => ({ value: d, label: d }))}
          value={discover.value}
          onChange={(v) => setDiscover((s) => ({ ...s, value: v }))}
          disabled={discover.loading}
        />
      </Modal>
    </Card>
  );
};

export default ConnectionsSection;
