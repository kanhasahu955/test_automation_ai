import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
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
import type { User, UserRole } from "@apptypes/api";
import { usersApi } from "@services/usersApi";
import { getApiErrorMessage } from "@utils/apiErrors";

const { Text } = Typography;

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "QA_MANAGER", label: "QA Manager" },
  { value: "QA_ENGINEER", label: "QA Engineer" },
  { value: "DATA_ENGINEER", label: "Data Engineer" },
  { value: "DEVELOPER", label: "Developer" },
];

const ROLE_COLOR: Record<UserRole, string> = {
  ADMIN: "magenta",
  QA_MANAGER: "geekblue",
  QA_ENGINEER: "blue",
  DATA_ENGINEER: "cyan",
  DEVELOPER: "purple",
};

type UserFormShape = {
  name: string;
  email: string;
  role: UserRole;
  is_active?: boolean;
  password?: string;
};

export const UsersSection = () => {
  const { message } = App.useApp();
  const role = useAppSelector((s) => s.auth.user?.role);
  const isAdmin = role === "ADMIN";

  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<UserFormShape>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await usersApi.list(1, 100, search || undefined);
      setItems(page.items);
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  }, [message, search]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [load, isAdmin]);

  if (!isAdmin) {
    return (
      <Card>
        <Alert
          showIcon
          type="info"
          message="User management is only available to administrators."
        />
      </Card>
    );
  }

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ role: "QA_ENGINEER", is_active: true });
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    form.setFieldsValue({
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      password: "",
    });
    setModalOpen(true);
  };

  const onSubmit = async (values: UserFormShape) => {
    setSaving(true);
    try {
      if (editing) {
        await usersApi.update(editing.id, {
          name: values.name,
          role: values.role,
          is_active: values.is_active,
          password: values.password ? values.password : undefined,
        });
        message.success("User updated.");
      } else {
        if (!values.password) {
          message.error("Password is required for new users.");
          setSaving(false);
          return;
        }
        await usersApi.create({
          name: values.name,
          email: values.email,
          role: values.role,
          password: values.password,
        });
        message.success("User created.");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to save user"));
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async (user: User) => {
    try {
      await usersApi.remove(user.id);
      message.success(`User "${user.name}" deleted.`);
      await load();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to delete user"));
    }
  };

  const columns: ColumnsType<User> = [
    {
      title: "Name",
      dataIndex: "name",
      render: (_v, u) => (
        <Space direction="vertical" size={0}>
          <Text strong>{u.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {u.email}
          </Text>
        </Space>
      ),
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: "Role",
      dataIndex: "role",
      width: 160,
      render: (r: UserRole) => <Tag color={ROLE_COLOR[r]}>{r}</Tag>,
      filters: ROLE_OPTIONS.map((opt) => ({ text: opt.label, value: opt.value })),
      onFilter: (value, record) => record.role === value,
    },
    {
      title: "Status",
      dataIndex: "is_active",
      width: 110,
      render: (v: boolean) => (
        <Tag color={v ? "success" : "default"}>{v ? "Active" : "Inactive"}</Tag>
      ),
    },
    {
      title: "Created",
      dataIndex: "created_at",
      width: 200,
      render: (v?: string) => (v ? new Date(v).toLocaleString() : "—"),
    },
    {
      title: "",
      key: "actions",
      width: 140,
      align: "right",
      render: (_v, u) => (
        <Space size={4}>
          <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(u)} />
          <Popconfirm
            title={`Delete "${u.name}"?`}
            okType="danger"
            okText="Delete"
            onConfirm={() => onRemove(u)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <Text strong>Users</Text>
          <Tag>{items.length}</Tag>
        </Space>
      }
      extra={
        <Space>
          <Input.Search
            placeholder="Search by name or email…"
            allowClear
            onSearch={setSearch}
            style={{ width: 240 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            New user
          </Button>
        </Space>
      }
    >
      <DataTable<User>
        rowKey="id"
        data={items}
        columns={columns}
        loading={loading}
        pagination={{ pageSize: 10 }}
        emptyDescription="No users yet."
      />

      <Modal
        title={editing ? `Edit "${editing.name}"` : "New user"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={form.submit}
        confirmLoading={saving}
        okText={editing ? "Save" : "Create"}
        destroyOnHidden
      >
        <Form<UserFormShape> form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item
            label="Full name"
            name="name"
            rules={[{ required: true, min: 2, max: 150 }]}
          >
            <Input placeholder="Jane Doe" />
          </Form.Item>
          <Form.Item
            label="Email"
            name="email"
            rules={[{ required: true, type: "email" }]}
          >
            <Input placeholder="jane@yourcompany.com" disabled={!!editing} />
          </Form.Item>
          <Form.Item
            label="Role"
            name="role"
            rules={[{ required: true }]}
          >
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          {editing && (
            <Form.Item label="Active" name="is_active" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
          <Form.Item
            label={editing ? "New password (leave blank to keep)" : "Password"}
            name="password"
            rules={
              editing
                ? [{ min: 8, message: "Min 8 characters" }]
                : [{ required: true, min: 8, message: "Min 8 characters" }]
            }
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default UsersSection;
