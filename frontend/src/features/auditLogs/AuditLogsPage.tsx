import { ReloadOutlined } from "@ant-design/icons";
import { App, Button, Result, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";

import PageHeader from "@components/common/PageHeader";
import { useAppSelector } from "@app/store";
import { auditLogsApi, type AuditLog } from "@services/auditLogsApi";
import { JsonView } from "@components/editors";
import { getApiErrorMessage } from "@utils/apiErrors";

const { Text } = Typography;

export const AuditLogsPage = () => {
  const role = useAppSelector((s) => s.auth.user?.role);
  const isAdmin = role === "ADMIN";
  const { message } = App.useApp();

  const [rows, setRows] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setForbidden(false);
    try {
      const data = await auditLogsApi.list(200);
      setRows(data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setForbidden(true);
        setRows([]);
      } else {
        message.error(getApiErrorMessage(err, "Failed to load audit log"));
      }
    } finally {
      setLoading(false);
    }
  }, [isAdmin, message]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const columns: ColumnsType<AuditLog> = [
    {
      title: "Time",
      dataIndex: "created_at",
      width: 180,
      render: (d: string | null) => (d ? new Date(d).toLocaleString() : "—"),
    },
    { title: "Action", dataIndex: "action", width: 140, ellipsis: true },
    {
      title: "Entity",
      key: "entity",
      width: 200,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          {r.entity_type && <Tag>{r.entity_type}</Tag>}
          {r.entity_id && <Text code className="!text-xs">{r.entity_id}</Text>}
        </Space>
      ),
    },
    { title: "User id", dataIndex: "user_id", width: 120, ellipsis: true },
    { title: "IP", dataIndex: "ip_address", width: 120 },
    {
      title: "Changes",
      key: "delta",
      width: 280,
      render: (_, r) => {
        if (!r.old_value && !r.new_value) return "—";
        return (
          <div className="max-h-40 overflow-auto text-xs">
            {r.old_value && (
              <div className="mb-1">
                <Text type="secondary">old</Text>
                <JsonView value={r.old_value} maxHeight={120} />
              </div>
            )}
            {r.new_value && (
              <div>
                <Text type="secondary">new</Text>
                <JsonView value={r.new_value} maxHeight={120} />
              </div>
            )}
          </div>
        );
      },
    },
  ];

  if (!isAdmin) {
    return (
      <div className="min-w-0">
        <PageHeader
          title="Audit logs"
          subtitle="Security and compliance trail of mutating API actions."
        />
        <Result
          status="403"
          title="Administrators only"
          subTitle="The audit log API is restricted to users with the Admin role."
        />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="min-w-0">
        <PageHeader
          title="Audit logs"
          subtitle="Security and compliance trail of mutating API actions."
        />
        <Result
          status="403"
          title="Access denied"
          subTitle="Your session is not allowed to read audit logs. Sign in as an admin or contact support."
        />
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <PageHeader
        title="Audit logs"
        subtitle="Recent mutating actions (up to 200 entries)."
        actions={
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>
            Refresh
          </Button>
        }
      />
      <Table<AuditLog>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        scroll={{ x: "max-content" }}
      />
    </div>
  );
};

export default AuditLogsPage;
