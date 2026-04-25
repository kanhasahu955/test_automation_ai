import { PlusOutlined } from "@ant-design/icons";
import { App, Button, Card, Col, Empty, Form, Input, Modal, Row, Space, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import PageHeader from "@components/common/PageHeader";
import { useAppDispatch, useAppSelector } from "@app/store";
import {
  createProjectRequest,
  fetchProjectsRequest,
  selectProject,
} from "./projectsSlice";

const { Text, Title } = Typography;

type FormValues = { name: string; description?: string };

export const ProjectsPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items, loading, error } = useAppSelector((s) => s.projects);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const { message } = App.useApp();

  useEffect(() => {
    dispatch(fetchProjectsRequest());
  }, [dispatch]);

  useEffect(() => {
    if (error) message.error(error);
  }, [error, message]);

  const onCreate = async () => {
    const values = await form.validateFields();
    dispatch(createProjectRequest(values));
    setOpen(false);
    form.resetFields();
  };

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Organize work, ownership, and quality reporting per product."
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
            New Project
          </Button>
        }
      />

      {items.length === 0 && !loading ? (
        <Card>
          <Empty
            description={
              <Space direction="vertical" align="center">
                <Title level={4} style={{ margin: 0 }}>
                  No projects yet
                </Title>
                <Text type="secondary">
                  Spin up your first project to begin authoring tests and tracking quality.
                </Text>
              </Space>
            }
          >
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
              Create your first project
            </Button>
          </Empty>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {items.map((p) => (
            <Col xs={24} sm={12} md={8} key={p.id}>
              <Card
                hoverable
                loading={loading && items.length === 0}
                onClick={() => {
                  dispatch(selectProject(p));
                  navigate(`/projects/${p.id}`);
                }}
              >
                <Space style={{ width: "100%", justifyContent: "space-between" }} align="start">
                  <Title level={4} style={{ margin: 0 }}>
                    {p.name}
                  </Title>
                  <Tag color={p.status === "ACTIVE" ? "success" : "default"}>{p.status}</Tag>
                </Space>
                <Text type="secondary" style={{ display: "block", marginTop: 8, minHeight: 40 }}>
                  {p.description || "No description"}
                </Text>
                <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 8 }}>
                  Created {p.created_at ? new Date(p.created_at).toLocaleDateString() : ""}
                </Text>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title="New project"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onCreate}
        okText="Create"
        confirmLoading={loading}
        destroyOnClose
      >
        <Form<FormValues> form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            label="Project name"
            rules={[{ required: true, message: "Project name is required" }]}
          >
            <Input placeholder="LiveBhoomi Mobile" autoFocus />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Short description (optional)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectsPage;
