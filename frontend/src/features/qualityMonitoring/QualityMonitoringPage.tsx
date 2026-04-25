import { DeleteOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";

import PageHeader from "@components/common/PageHeader";
import ProjectPicker from "@components/common/ProjectPicker";
import SelectProjectHint from "@components/common/SelectProjectHint";
import { useAppSelector } from "@app/store";
import useSelectedProject from "@hooks/useSelectedProject";
import {
  qualityRulesApi,
  type QualityRule,
  type QualityRuleCreate,
  type RuleType,
  type Severity,
} from "@services/qualityRulesApi";
import { getApiErrorMessage } from "@utils/apiErrors";

const { Text } = Typography;

const RULE_TYPES: RuleType[] = [
  "NOT_NULL",
  "UNIQUE",
  "RANGE",
  "REGEX",
  "ROW_COUNT",
  "FRESHNESS",
  "CUSTOM_SQL",
];

const SEVERITIES: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const canMutateData = (role: string | undefined) =>
  role === "ADMIN" || role === "QA_MANAGER" || role === "DATA_ENGINEER";

export const QualityMonitoringPage = () => {
  const { projectId, hasProject } = useSelectedProject();
  const role = useAppSelector((s) => s.auth.user?.role);
  const canWrite = canMutateData(role);
  const { message } = App.useApp();

  const [rows, setRows] = useState<QualityRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<QualityRuleCreate & { rule_config_json?: string }>();

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await qualityRulesApi.list(projectId);
      setRows(data);
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to load quality rules"));
    } finally {
      setLoading(false);
    }
  }, [projectId, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async () => {
    if (!projectId) return;
    const v = await form.validateFields();
    let rule_config: Record<string, unknown> | null | undefined;
    if (v.rule_config_json?.trim()) {
      try {
        rule_config = JSON.parse(v.rule_config_json) as Record<string, unknown>;
      } catch {
        message.error("Rule config must be valid JSON");
        return;
      }
    }
    setSaving(true);
    try {
      const payload: QualityRuleCreate = {
        name: v.name,
        rule_type: v.rule_type,
        table_name: v.table_name || null,
        column_name: v.column_name || null,
        severity: v.severity,
        is_active: v.is_active ?? true,
        ...(rule_config != null ? { rule_config } : {}),
      };
      await qualityRulesApi.create(projectId, payload);
      message.success("Rule created");
      setOpen(false);
      form.resetFields();
      void load();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to create rule"));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    try {
      await qualityRulesApi.remove(id);
      message.success("Rule deleted");
      void load();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to delete rule"));
    }
  };

  const baseColumns: ColumnsType<QualityRule> = [
    { title: "Name", dataIndex: "name", ellipsis: true },
    {
      title: "Type",
      dataIndex: "rule_type",
      width: 120,
      render: (t: RuleType) => <Tag>{t}</Tag>,
    },
    { title: "Table", dataIndex: "table_name", width: 140, ellipsis: true },
    { title: "Column", dataIndex: "column_name", width: 120, ellipsis: true },
    {
      title: "Severity",
      dataIndex: "severity",
      width: 100,
      render: (s: Severity) => <Tag color={s === "CRITICAL" ? "red" : s === "HIGH" ? "orange" : "default"}>{s}</Tag>,
    },
    {
      title: "Active",
      dataIndex: "is_active",
      width: 90,
      render: (a: boolean) => (a ? "Yes" : "No"),
    },
    {
      title: "Created",
      dataIndex: "created_at",
      width: 180,
      render: (d: string | null) => (d ? new Date(d).toLocaleString() : "—"),
    },
  ];
  const columns: ColumnsType<QualityRule> = canWrite
    ? [
        ...baseColumns,
        {
          title: "",
          key: "actions",
          width: 80,
          render: (_: unknown, r) => (
            <Popconfirm title="Delete this rule?" onConfirm={() => void onDelete(r.id)}>
              <Button type="text" danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          ),
        },
      ]
    : baseColumns;

  return (
    <div className="min-w-0">
      <PageHeader
        title="Quality monitoring"
        subtitle="Data quality rules for your project. Evaluations attach to execution runs as the platform evolves."
        actions={
          <Space wrap>
            <ProjectPicker />
            {canWrite && hasProject && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
                New rule
              </Button>
            )}
            <Button icon={<ReloadOutlined />} onClick={() => void load()} disabled={!hasProject}>
              Refresh
            </Button>
          </Space>
        }
      />

      {!hasProject && <SelectProjectHint message="Select a project to list and manage quality rules." />}

      <Table<QualityRule>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 15, showSizeChanger: true }}
        scroll={{ x: "max-content" }}
      />

      <Modal
        title="New quality rule"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onCreate}
        confirmLoading={saving}
        destroyOnClose
        width={560}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ severity: "MEDIUM" as Severity, is_active: true, rule_type: "NOT_NULL" as RuleType }}
        >
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. users.email not null" />
          </Form.Item>
          <Form.Item name="rule_type" label="Rule type" rules={[{ required: true }]}>
            <Select
              options={RULE_TYPES.map((t) => ({ value: t, label: t }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="table_name" label="Table (optional)">
            <Input placeholder="schema.table" />
          </Form.Item>
          <Form.Item name="column_name" label="Column (optional)">
            <Input />
          </Form.Item>
          <Form.Item name="severity" label="Severity" rules={[{ required: true }]}>
            <Select options={SEVERITIES.map((s) => ({ value: s, label: s }))} />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item
            name="rule_config_json"
            label="Rule config (JSON, optional)"
            extra="Type-specific parameters; leave empty for simple rules."
          >
            <Input.TextArea rows={4} placeholder='{"min":0,"max":100}' />
          </Form.Item>
        </Form>
        {!canWrite && <Text type="warning">Your role cannot create quality rules (Admin, QA manager, or Data engineer).</Text>}
      </Modal>
    </div>
  );
};

export default QualityMonitoringPage;
