import {
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";

import PageHeader from "@components/common/PageHeader";
import ProjectPicker from "@components/common/ProjectPicker";
import SelectProjectHint from "@components/common/SelectProjectHint";
import { useAppDispatch, useAppSelector } from "@app/store";
import {
  generateTestCasesRequest,
  resetAi,
} from "@features/aiGenerator/aiSlice";
import {
  createRequest,
  deleteRequest,
  fetchListRequest,
} from "./testCasesSlice";
import type { TestCase, TestCaseInput } from "@apptypes/api";

const { Text } = Typography;

const TYPES: TestCase["test_type"][] = ["MANUAL", "API", "UI", "SQL", "DATA_QUALITY", "NO_CODE"];
const PRIORITIES: TestCase["priority"][] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUSES: TestCase["status"][] = ["DRAFT", "READY", "DEPRECATED"];

const priorityColor: Record<TestCase["priority"], string> = {
  LOW: "default",
  MEDIUM: "processing",
  HIGH: "warning",
  CRITICAL: "error",
};

export const TestCasesPage = () => {
  const dispatch = useAppDispatch();
  const project = useAppSelector((s) => s.projects.selected);
  const { items, loading, saving, error } = useAppSelector((s) => s.testCases);
  const ai = useAppSelector((s) => s.ai);
  const { message } = App.useApp();

  const [form] = Form.useForm<TestCaseInput>();
  const [aiForm] = Form.useForm<{ requirement: string; count: number }>();
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    if (project?.id) dispatch(fetchListRequest(project.id));
  }, [project?.id, dispatch]);

  useEffect(() => {
    if (error) message.error(error);
  }, [error, message]);

  const onCreate = async () => {
    if (!project) return;
    const data = await form.validateFields();
    dispatch(createRequest({ projectId: project.id, data }));
    setOpen(false);
    form.resetFields();
  };

  const onGenerate = async () => {
    const values = await aiForm.validateFields();
    dispatch(generateTestCasesRequest({ requirement: values.requirement, count: values.count }));
  };

  const persistGenerated = (g: (typeof ai.generatedTestCases)[number]) => {
    if (!project) return;
    dispatch(
      createRequest({
        projectId: project.id,
        data: {
          title: g.title,
          description: g.description,
          preconditions: g.preconditions,
          expected_result: g.expected_result,
          test_type: (g.test_type as TestCase["test_type"]) || "MANUAL",
          priority: (g.priority as TestCase["priority"]) || "MEDIUM",
          status: "DRAFT",
          steps: g.steps?.map((s, i) => ({
            step_order: s.step_order ?? i + 1,
            action: s.action,
            expected_result: s.expected_result,
          })),
        },
      }),
    );
  };

  const columns: ColumnsType<TestCase> = [
    {
      title: "Title",
      dataIndex: "title",
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row.title}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.description?.slice(0, 90)}
          </Text>
        </Space>
      ),
    },
    {
      title: "Type",
      dataIndex: "test_type",
      width: 130,
      render: (type: TestCase["test_type"]) => <Tag>{type}</Tag>,
    },
    {
      title: "Priority",
      dataIndex: "priority",
      width: 120,
      render: (p: TestCase["priority"]) => <Tag color={priorityColor[p]}>{p}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 130,
      render: (s: TestCase["status"]) => (
        <Tag color={s === "READY" ? "success" : "default"}>{s}</Tag>
      ),
    },
    { title: "Steps", dataIndex: "steps", width: 80, render: (steps: TestCase["steps"]) => steps?.length ?? 0 },
    {
      title: "",
      key: "actions",
      width: 60,
      align: "right",
      render: (_, row) => (
        <Popconfirm
          title="Delete this test case?"
          onConfirm={() => dispatch(deleteRequest(row.id))}
          okText="Delete"
          okButtonProps={{ danger: true }}
        >
          <Button size="small" icon={<DeleteOutlined />} danger type="text" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Test Cases"
        subtitle="Author and manage manual + automated test cases."
        actions={
          <Space>
            <ProjectPicker />
            <Button
              icon={<ThunderboltOutlined />}
              onClick={() => {
                dispatch(resetAi());
                setAiOpen(true);
              }}
              disabled={!project}
            >
              Generate with AI
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setOpen(true)}
              disabled={!project}
            >
              New Test Case
            </Button>
          </Space>
        }
      />

      {!project && (
        <SelectProjectHint message="Select a project to view its test cases." />
      )}

      <Card>
        <Table<TestCase>
          rowKey="id"
          dataSource={items}
          columns={columns}
          loading={loading}
          size="middle"
          pagination={{ pageSize: 10, showSizeChanger: true }}
          locale={{ emptyText: project ? "No test cases yet. Create one or generate with AI." : "" }}
        />
      </Card>

      <Modal
        title="New Test Case"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onCreate}
        okText="Create"
        confirmLoading={saving}
        width={640}
        destroyOnClose
      >
        <Form<TestCaseInput>
          form={form}
          layout="vertical"
          preserve={false}
          initialValues={{ test_type: "UI", priority: "MEDIUM", status: "DRAFT" }}
        >
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="Successful login with valid credentials" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="preconditions" label="Preconditions">
            <Input />
          </Form.Item>
          <Form.Item name="expected_result" label="Expected result">
            <Input />
          </Form.Item>
          <Space.Compact style={{ width: "100%", gap: 12, display: "flex" }}>
            <Form.Item name="test_type" label="Type" style={{ flex: 1 }}>
              <Select options={TYPES.map((t) => ({ value: t, label: t }))} />
            </Form.Item>
            <Form.Item name="priority" label="Priority" style={{ flex: 1 }}>
              <Select options={PRIORITIES.map((p) => ({ value: p, label: p }))} />
            </Form.Item>
            <Form.Item name="status" label="Status" style={{ flex: 1 }}>
              <Select options={STATUSES.map((s) => ({ value: s, label: s }))} />
            </Form.Item>
          </Space.Compact>
        </Form>
      </Modal>

      <Modal
        title="Generate test cases with AI"
        open={aiOpen}
        onCancel={() => setAiOpen(false)}
        footer={null}
        width={720}
        destroyOnClose
      >
        <Form<{ requirement: string; count: number }>
          form={aiForm}
          layout="vertical"
          initialValues={{ count: 5 }}
        >
          <Form.Item
            name="requirement"
            label="Requirement / user story"
            rules={[{ required: true }]}
          >
            <Input.TextArea
              rows={5}
              placeholder="As a user, I want to reset my password using my email so that I can recover access..."
            />
          </Form.Item>
          <Form.Item name="count" label="How many to generate">
            <Select
              options={[3, 5, 8, 10].map((n) => ({ value: n, label: `${n} cases` }))}
              style={{ maxWidth: 160 }}
            />
          </Form.Item>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={ai.loading}
            onClick={onGenerate}
            block
          >
            Generate drafts
          </Button>
        </Form>

        {ai.generatedTestCases.length > 0 && (
          <List
            style={{ marginTop: 16 }}
            bordered
            dataSource={ai.generatedTestCases}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button
                    key="save"
                    icon={<SaveOutlined />}
                    type="link"
                    onClick={() => persistGenerated(item)}
                  >
                    Save
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{item.title}</Text>
                      {item.priority && <Tag>{item.priority}</Tag>}
                      {item.test_type && <Tag color="processing">{item.test_type}</Tag>}
                    </Space>
                  }
                  description={item.description}
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </div>
  );
};

export default TestCasesPage;
