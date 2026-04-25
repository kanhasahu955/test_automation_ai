import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";

import PageHeader from "@components/common/PageHeader";
import ProjectPicker from "@components/common/ProjectPicker";
import { useAppSelector } from "@app/store";
import useSelectedProject from "@hooks/useSelectedProject";
import {
  notificationsApi,
  type Channel,
  type NotificationItem,
  type NotificationStatus,
} from "@services/notificationsApi";
import { getApiErrorMessage } from "@utils/apiErrors";

const { Text } = Typography;

const CHANNELS: { value: Channel; label: string }[] = [
  { value: "EMAIL", label: "Email" },
  { value: "SLACK", label: "Slack" },
  { value: "TEAMS", label: "Teams" },
  { value: "WEBHOOK", label: "Webhook" },
];

const statusColor: Record<NotificationStatus, string> = {
  PENDING: "processing",
  SENT: "success",
  FAILED: "error",
};

export const NotificationsPage = () => {
  const { projectId, hasProject } = useSelectedProject();
  const role = useAppSelector((s) => s.auth.user?.role);
  const isAdmin = role === "ADMIN";
  const { message } = App.useApp();

  const [rows, setRows] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [projectOnly, setProjectOnly] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{
    channel: Channel;
    message: string;
    recipient?: string;
    event_type?: string;
  }>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pid = projectOnly && hasProject ? projectId : null;
      const data = await notificationsApi.list(pid, 200);
      setRows(data);
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to load notifications"));
    } finally {
      setLoading(false);
    }
  }, [hasProject, projectId, projectOnly, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await notificationsApi.create({
        channel: v.channel,
        message: v.message,
        recipient: v.recipient || null,
        event_type: v.event_type || null,
        project_id: hasProject && projectId ? projectId : null,
      });
      message.success("Notification created");
      setCreateOpen(false);
      form.resetFields();
      void load();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to create notification"));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<NotificationItem> = [
    {
      title: "Status",
      dataIndex: "status",
      width: 100,
      render: (s: NotificationStatus) => <Tag color={statusColor[s]}>{s}</Tag>,
    },
    {
      title: "Channel",
      dataIndex: "channel",
      width: 100,
    },
    {
      title: "Message",
      dataIndex: "message",
      ellipsis: true,
      render: (m: string | null) => m || "—",
    },
    {
      title: "Recipient / event",
      key: "meta",
      width: 220,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          {r.recipient && <Text type="secondary">{r.recipient}</Text>}
          {r.event_type && <Tag>{r.event_type}</Tag>}
        </Space>
      ),
    },
    {
      title: "Project",
      dataIndex: "project_id",
      width: 100,
      render: (id: string | null) => (id ? <Text code>{id.slice(0, 8)}…</Text> : "—"),
    },
    {
      title: "Created",
      dataIndex: "created_at",
      width: 180,
      render: (d: string | null) => (d ? new Date(d).toLocaleString() : "—"),
    },
  ];

  return (
    <div className="min-w-0">
      <PageHeader
        title="Notifications"
        subtitle="Delivery log and admin test sends for in-app notification records."
        actions={
          <Space wrap>
            <ProjectPicker />
            {isAdmin && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
                Test send
              </Button>
            )}
            <Button icon={<ReloadOutlined />} onClick={() => void load()}>
              Refresh
            </Button>
          </Space>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="text-secondary text-sm">Scope</span>
        <Switch
          checked={projectOnly}
          onChange={setProjectOnly}
          checkedChildren="This project"
          unCheckedChildren="All projects"
          disabled={!hasProject}
        />
      </div>

      <Table<NotificationItem>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        scroll={{ x: "max-content" }}
      />

      <Modal
        title="Send test notification (admin)"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={onCreate}
        confirmLoading={saving}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" initialValues={{ channel: "EMAIL" as Channel }}>
          <Form.Item name="channel" label="Channel" rules={[{ required: true }]}>
            <Select options={CHANNELS} />
          </Form.Item>
          <Form.Item name="message" label="Message" rules={[{ required: true, message: "Message required" }]}>
            <Input.TextArea rows={3} placeholder="Short body stored on the record" />
          </Form.Item>
          <Form.Item name="recipient" label="Recipient (optional)">
            <Input placeholder="email, webhook URL, or channel id" />
          </Form.Item>
          <Form.Item name="event_type" label="Event type (optional)">
            <Input placeholder="e.g. test.manual" />
          </Form.Item>
        </Form>
        {!isAdmin && (
          <Text type="warning">Only administrators can call the create API.</Text>
        )}
      </Modal>
    </div>
  );
};

export default NotificationsPage;
