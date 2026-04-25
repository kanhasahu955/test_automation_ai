import { ThunderboltOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  List,
  Row,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
} from "antd";

import PageHeader from "@components/common/PageHeader";
import { JsonView } from "@components/editors";
import { useAppDispatch, useAppSelector } from "@app/store";
import {
  analyzeFailureRequest,
  edgeCasesRequest,
  generateFlowRequest,
  generateTestCasesRequest,
} from "./aiSlice";

const { Text, Title } = Typography;

export const AIGeneratorPage = () => {
  const dispatch = useAppDispatch();
  const ai = useAppSelector((s) => s.ai);
  const [tcForm] = Form.useForm<{ requirement: string; count: number }>();
  const [flowForm] = Form.useForm<{ scenario: string }>();
  const [failForm] = Form.useForm<{
    test_name: string;
    error_message: string;
    logs?: string;
  }>();
  const [edgeForm] = Form.useForm<{ requirement: string }>();

  return (
    <div>
      <PageHeader
        title="AI Studio"
        subtitle="Use LLMs to accelerate test design, debugging and coverage."
      />

      <Card>
        <Tabs
          defaultActiveKey="tests"
          items={[
            {
              key: "tests",
              label: "Test cases",
              children: (
                <Space direction="vertical" style={{ width: "100%" }} size={16}>
                  <Form
                    form={tcForm}
                    layout="vertical"
                    initialValues={{ count: 5 }}
                    onFinish={(values) =>
                      dispatch(
                        generateTestCasesRequest({
                          requirement: values.requirement,
                          count: values.count,
                        }),
                      )
                    }
                  >
                    <Form.Item
                      name="requirement"
                      label="Requirement"
                      rules={[{ required: true }]}
                    >
                      <Input.TextArea rows={4} />
                    </Form.Item>
                    <Form.Item name="count" label="Count">
                      <Select
                        options={[3, 5, 8, 10].map((n) => ({
                          value: n,
                          label: `${n} cases`,
                        }))}
                        style={{ maxWidth: 160 }}
                      />
                    </Form.Item>
                    <Button
                      type="primary"
                      icon={<ThunderboltOutlined />}
                      htmlType="submit"
                      loading={ai.loading}
                    >
                      Generate test cases
                    </Button>
                  </Form>
                  {ai.generatedTestCases.length > 0 && (
                    <Row gutter={[16, 16]}>
                      {ai.generatedTestCases.map((tc, i) => (
                        <Col xs={24} md={12} key={i}>
                          <Card size="small">
                            <Space direction="vertical" size={4}>
                              <Space wrap>
                                <Text strong>{tc.title}</Text>
                                {tc.priority && <Tag>{tc.priority}</Tag>}
                                {tc.test_type && (
                                  <Tag color="processing">{tc.test_type}</Tag>
                                )}
                              </Space>
                              <Text type="secondary">{tc.description}</Text>
                              {tc.steps?.map((s) => (
                                <Text
                                  key={s.step_order}
                                  style={{ fontSize: 12, display: "block" }}
                                >
                                  {s.step_order}. {s.action}
                                </Text>
                              ))}
                            </Space>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  )}
                </Space>
              ),
            },
            {
              key: "flow",
              label: "No-code flow",
              children: (
                <Space direction="vertical" style={{ width: "100%" }} size={16}>
                  <Form
                    form={flowForm}
                    layout="vertical"
                    onFinish={(values) =>
                      dispatch(
                        generateFlowRequest({ scenario: values.scenario }),
                      )
                    }
                  >
                    <Form.Item
                      name="scenario"
                      label="Scenario"
                      rules={[{ required: true }]}
                    >
                      <Input.TextArea rows={4} />
                    </Form.Item>
                    <Button
                      type="primary"
                      icon={<ThunderboltOutlined />}
                      htmlType="submit"
                      loading={ai.loading}
                    >
                      Generate flow
                    </Button>
                  </Form>
                  {ai.generatedFlow && (
                    <JsonView
                      title="Generated flow"
                      value={ai.generatedFlow}
                      maxHeight={360}
                    />
                  )}
                </Space>
              ),
            },
            {
              key: "failure",
              label: "Failure analysis",
              children: (
                <Space direction="vertical" style={{ width: "100%" }} size={16}>
                  <Form
                    form={failForm}
                    layout="vertical"
                    onFinish={(values) =>
                      dispatch(analyzeFailureRequest(values))
                    }
                  >
                    <Form.Item
                      name="test_name"
                      label="Test name"
                      rules={[{ required: true }]}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item
                      name="error_message"
                      label="Error message"
                      rules={[{ required: true }]}
                    >
                      <Input.TextArea rows={2} />
                    </Form.Item>
                    <Form.Item name="logs" label="Logs">
                      <Input.TextArea rows={4} />
                    </Form.Item>
                    <Button
                      type="primary"
                      icon={<ThunderboltOutlined />}
                      htmlType="submit"
                      loading={ai.loading}
                    >
                      Analyze
                    </Button>
                  </Form>
                  {ai.failureAnalysis ? (
                    (() => {
                      const fa = ai.failureAnalysis;
                      return (
                        <Alert
                          type={fa.is_flaky ? "warning" : "info"}
                          showIcon
                          message={
                            <Title level={5} style={{ margin: 0 }}>
                              {fa.summary}
                            </Title>
                          }
                          description={
                            <Space direction="vertical">
                              <Text>
                                <strong>Likely cause:</strong>{" "}
                                {fa.likely_root_cause}
                              </Text>
                              <Text>
                                <strong>Suggested fix:</strong>{" "}
                                {fa.suggested_fix}
                              </Text>
                            </Space>
                          }
                        />
                      );
                    })()
                  ) : null}
                </Space>
              ),
            },
            {
              key: "edge",
              label: "Edge cases",
              children: (
                <Space direction="vertical" style={{ width: "100%" }} size={16}>
                  <Form
                    form={edgeForm}
                    layout="vertical"
                    onFinish={(values) => dispatch(edgeCasesRequest(values))}
                  >
                    <Form.Item
                      name="requirement"
                      label="Requirement"
                      rules={[{ required: true }]}
                    >
                      <Input.TextArea rows={4} />
                    </Form.Item>
                    <Button
                      type="primary"
                      icon={<ThunderboltOutlined />}
                      htmlType="submit"
                      loading={ai.loading}
                    >
                      Suggest edge cases
                    </Button>
                  </Form>
                  {ai.edgeCases.length > 0 && (
                    <List<string>
                      bordered
                      dataSource={ai.edgeCases}
                      renderItem={(c: string) => (
                        <List.Item>
                          <Space>
                            <ThunderboltOutlined style={{ color: "#f59e0b" }} />
                            <Text>{c}</Text>
                          </Space>
                        </List.Item>
                      )}
                    />
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default AIGeneratorPage;
