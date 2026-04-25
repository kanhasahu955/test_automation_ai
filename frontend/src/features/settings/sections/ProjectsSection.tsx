import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";

import { useAppSelector } from "@app/store";
import { DataTable } from "@components/tables";
import { projectsApi } from "@services/projectsApi";
import type { Project } from "@apptypes/api";
import { getApiErrorMessage } from "@utils/apiErrors";

const { Text } = Typography;

type ProjectFormShape = {
  name: string;
  description?: string;
  status?: Project["status"];
};

/**
 * Admin/QA-Manager CRUD for projects. Reuses the existing `projectsApi`
 * client; creates and edits go through a single modal form.
 */
export const ProjectsSection = () => {
  const { message } = App.useApp();
  const role = useAppSelector((s) => s.auth.user?.role);
  const canMutate = role === "ADMIN" || role === "QA_MANAGER";

  const [form] = Form.useForm<ProjectFormShape>();
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Project | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await projectsApi.list(1, 100, search || undefined);
      setItems(page.items);
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to load projects"));
    } finally {
      setLoading(false);
    }
  }, [message, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ status: "ACTIVE" });
    setModalOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditing(project);
    form.setFieldsValue({
      name: project.name,
      description: project.description,
      status: project.status,
    });
    setModalOpen(true);
  };

  const onSubmit = async (values: ProjectFormShape) => {
    setSaving(true);
    try {
      if (editing) {
        await projectsApi.update(editing.id, values);
        message.success("Project updated.");
      } else {
        await projectsApi.create({
          name: values.name,
          description: values.description,
        });
        message.success("Project created.");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to save project"));
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async (project: Project) => {
    try {
      await projectsApi.remove(project.id);
      message.success(`Project "${project.name}" deleted.`);
      await load();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to delete project"));
    }
  };

  const columns: ColumnsType<Project> = [
    {
      title: "Name",
      dataIndex: "name",
      render: (_v, p) => (
        <Space direction="vertical" size={0}>
          <Text strong>{p.name}</Text>
          {p.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {p.description}
            </Text>
          )}
        </Space>
      ),
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 130,
      render: (s: Project["status"]) => (
        <Tag color={s === "ACTIVE" ? "success" : "default"}>{s}</Tag>
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
      render: (_v, p) => (
        <Space size={4}>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEdit(p)}
            disabled={!canMutate}
          />
          <Popconfirm
            title={`Delete project "${p.name}"?`}
            description="This permanently removes the project and all linked records."
            okType="danger"
            okText="Delete"
            disabled={!canMutate}
            onConfirm={() => onRemove(p)}
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
          <Text strong>Projects</Text>
          <Tag>{items.length}</Tag>
        </Space>
      }
      extra={
        <Space>
          <Input.Search
            placeholder="Search projects…"
            allowClear
            onSearch={(value) => setSearch(value)}
            style={{ width: 220 }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
            disabled={!canMutate}
          >
            New project
          </Button>
        </Space>
      }
    >
      <DataTable<Project>
        rowKey="id"
        data={items}
        columns={columns}
        loading={loading}
        pagination={{ pageSize: 10 }}
        emptyDescription="No projects yet."
      />

      <Modal
        title={editing ? `Edit "${editing.name}"` : "New project"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={form.submit}
        confirmLoading={saving}
        okText="Save"
        destroyOnHidden
      >
        <Form<ProjectFormShape> form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, min: 2, max: 200, message: "2–200 characters" }]}
          >
            <Input placeholder="Acme Banking - Mobile" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} placeholder="Optional summary…" />
          </Form.Item>
          {editing && (
            <Form.Item label="Status" name="status">
              <Select
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "ARCHIVED", label: "Archived" },
                ]}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Card>
  );
};

export default ProjectsSection;
