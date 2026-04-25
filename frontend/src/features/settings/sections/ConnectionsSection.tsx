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
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";

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

const { Text } = Typography;

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

type ConnectionFormShape = DataSourceCreateInput;

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
    form.resetFields();
    form.setFieldsValue({
      source_type: "MYSQL",
      port: 3306,
      is_active: true,
    });
    setModalOpen(true);
  };

  const openEdit = (ds: DataSource) => {
    setEditing(ds);
    form.setFieldsValue({
      name: ds.name,
      source_type: ds.source_type,
      host: ds.host,
      port: ds.port ?? null,
      database_name: ds.database_name,
      username: ds.username,
      password: "",
      is_active: ds.is_active,
    });
    setModalOpen(true);
  };

  const onSubmit = async (values: ConnectionFormShape) => {
    if (!projectId) return;
    setSaving(true);
    try {
      const cleanedPassword =
        typeof values.password === "string" ? values.password : null;
      if (editing) {
        const payload = { ...values };
        if (!cleanedPassword) {
          delete payload.password;
        }
        await dataSourcesApi.update(editing.id, payload);
        message.success("Connection updated.");
      } else {
        await dataSourcesApi.create(projectId, values);
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
      width: 240,
      align: "right",
      render: (_v, ds) => (
        <Space size={4}>
          <Button
            type="text"
            icon={<ThunderboltOutlined />}
            loading={testingId === ds.id}
            onClick={() => onTest(ds)}
            disabled={!canMutate}
          >
            Test
          </Button>
          <Button
            type="text"
            icon={<SyncOutlined />}
            loading={scanningId === ds.id}
            onClick={() => onScan(ds)}
            disabled={!canMutate}
          >
            Scan
          </Button>
          <Button
            type="text"
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
            <Button type="text" danger icon={<DeleteOutlined />} disabled={!canMutate} />
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
        <DataTable<DataSource>
          rowKey="id"
          data={items}
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 10 }}
          emptyDescription="No connections yet."
        />
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
              }}
            />
          </Form.Item>
          <Space.Compact style={{ width: "100%", display: "flex", gap: 12 }} block>
            <Form.Item label="Host" name="host" style={{ flex: 1 }}>
              <Input placeholder="db.example.com" />
            </Form.Item>
            <Form.Item label="Port" name="port" style={{ width: 140 }}>
              <InputNumber min={1} max={65535} style={{ width: "100%" }} />
            </Form.Item>
          </Space.Compact>
          <Form.Item label="Database name" name="database_name">
            <Input placeholder="reporting" />
          </Form.Item>
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
          <Form.Item label="Active" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default ConnectionsSection;
