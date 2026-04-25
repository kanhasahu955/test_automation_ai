import {
  CrownOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
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
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppDispatch, useAppSelector } from "@app/store";
import { DataTable } from "@components/tables";
import { setUser } from "@features/auth/authSlice";
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
  const { message, modal } = App.useApp();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((s) => s.auth.user);
  const isAdmin = currentUser?.role === "ADMIN";

  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Per-row "role being applied" set — drives the Select's loading state. */
  const [rolePending, setRolePending] = useState<Set<string>>(new Set());
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

  /** How many active admins are currently in the loaded page — used to gate UX
   *  hints (e.g. disabling self-demotion when you're the only admin showing).
   *  Server still enforces the real invariant — this is just for nicer UX. */
  const activeAdminCount = useMemo(
    () => items.filter((u) => u.role === "ADMIN" && u.is_active).length,
    [items],
  );

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
        const updated = await usersApi.update(editing.id, {
          name: values.name,
          role: values.role,
          is_active: values.is_active,
          password: values.password ? values.password : undefined,
        });
        if (currentUser && updated.id === currentUser.id) {
          dispatch(setUser(updated));
        }
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

  /** Inline role rotation — the canonical "make admin / change role" UX. */
  const onRoleChange = async (user: User, nextRole: UserRole) => {
    if (user.role === nextRole) return;

    const isSelf = currentUser?.id === user.id;
    const isDemotingSelfFromAdmin =
      isSelf && user.role === "ADMIN" && nextRole !== "ADMIN";

    // Self-demotion is destructive — confirm first. The user will lose
    // access to admin-only screens (including this one) immediately.
    if (isDemotingSelfFromAdmin) {
      const ok = await new Promise<boolean>((resolve) => {
        modal.confirm({
          title: "Demote yourself from admin?",
          content:
            "You will lose access to admin-only screens (including User Management) as soon as this saves. Make sure another admin is available.",
          okText: "Yes, change my role",
          okButtonProps: { danger: true },
          cancelText: "Cancel",
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
      if (!ok) return;
    }

    setRolePending((s) => new Set(s).add(user.id));
    // Optimistic update — flip the cell immediately for snappy feel.
    const previous = user.role;
    setItems((rows) =>
      rows.map((r) => (r.id === user.id ? { ...r, role: nextRole } : r)),
    );

    try {
      const updated = await usersApi.updateRole(user.id, nextRole);
      // Sync from the server response in case anything else changed.
      setItems((rows) => rows.map((r) => (r.id === user.id ? updated : r)));
      if (isSelf && currentUser) {
        dispatch(setUser(updated));
      }
      message.success(
        nextRole === "ADMIN"
          ? `${user.name} is now an admin.`
          : `${user.name}'s role updated to ${nextRole.replace("_", " ")}.`,
      );
    } catch (err) {
      // Roll back the optimistic flip.
      setItems((rows) =>
        rows.map((r) => (r.id === user.id ? { ...r, role: previous } : r)),
      );
      message.error(getApiErrorMessage(err, "Failed to change role"));
    } finally {
      setRolePending((s) => {
        const next = new Set(s);
        next.delete(user.id);
        return next;
      });
    }
  };

  const columns: ColumnsType<User> = [
    {
      title: "Name",
      dataIndex: "name",
      render: (_v, u) => (
        <Space direction="vertical" size={0}>
          <Space size={6}>
            <Text strong>{u.name}</Text>
            {currentUser?.id === u.id && <Tag color="gold">you</Tag>}
          </Space>
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
      width: 200,
      filters: ROLE_OPTIONS.map((opt) => ({ text: opt.label, value: opt.value })),
      onFilter: (value, record) => record.role === value,
      render: (currentRole: UserRole, u) => {
        const lastAdminLockout =
          u.role === "ADMIN" && u.is_active && activeAdminCount <= 1;
        return (
          <Tooltip
            title={
              lastAdminLockout
                ? "This is the only active admin — promote someone else first."
                : undefined
            }
            placement="topLeft"
          >
            <Select
              value={currentRole}
              size="small"
              style={{ width: 170 }}
              variant="borderless"
              loading={rolePending.has(u.id)}
              disabled={rolePending.has(u.id) || lastAdminLockout}
              onChange={(value) => onRoleChange(u, value)}
              options={ROLE_OPTIONS.map((opt) => ({
                value: opt.value,
                label: <Tag color={ROLE_COLOR[opt.value]}>{opt.label}</Tag>,
              }))}
            />
          </Tooltip>
        );
      },
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
      width: 160,
      align: "right",
      render: (_v, u) => {
        const isSelf = currentUser?.id === u.id;
        const lastAdminLockout =
          u.role === "ADMIN" && u.is_active && activeAdminCount <= 1;
        return (
          <Space size={4}>
            {u.role !== "ADMIN" && (
              <Tooltip title="Make admin">
                <Button
                  type="text"
                  icon={<CrownOutlined />}
                  loading={rolePending.has(u.id)}
                  onClick={() => onRoleChange(u, "ADMIN")}
                />
              </Tooltip>
            )}
            <Tooltip title="Edit">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => openEdit(u)}
              />
            </Tooltip>
            <Popconfirm
              title={`Delete "${u.name}"?`}
              okType="danger"
              okText="Delete"
              disabled={isSelf || lastAdminLockout}
              onConfirm={() => onRemove(u)}
            >
              <Tooltip
                title={
                  isSelf
                    ? "You can't delete yourself"
                    : lastAdminLockout
                      ? "Can't delete the last active admin"
                      : "Delete"
                }
              >
                <Button
                  type="text"
                  danger
                  disabled={isSelf || lastAdminLockout}
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
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
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Promote a user to admin"
        description="Click the crown icon on any row to grant admin access, or use the role dropdown to change roles inline. The platform always keeps at least one active admin."
      />
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
