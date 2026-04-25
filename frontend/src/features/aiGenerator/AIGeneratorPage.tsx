import {
  CheckCircleOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
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
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import PageHeader from "@components/common/PageHeader";
import { JsonView } from "@components/editors";
import { useAppDispatch, useAppSelector } from "@app/store";
import { ROUTES } from "@constants/routes";
import { useReduxErrorToast } from "@hooks/useReduxErrorToast";
import { aiApi, type AiStreamHandle, type AiStreamMeta } from "@services/aiApi";
import {
  aiFailure,
  analyzeFailureRequest,
  edgeCasesSuccess,
  fetchAiStatusRequest,
  generateFlowRequest,
  generateTestCasesSuccess,
} from "./aiSlice";

const { Text, Title } = Typography;

export const AIGeneratorPage = () => {
  const dispatch = useAppDispatch();
  const ai = useAppSelector((s) => s.ai);
  const role = useAppSelector((s) => s.auth.user?.role);
  const isAdmin = role === "ADMIN";
  const [tcForm] = Form.useForm<{ requirement: string; count: number }>();
  const [flowForm] = Form.useForm<{ scenario: string }>();
  const [failForm] = Form.useForm<{
    test_name: string;
    error_message: string;
    logs?: string;
  }>();
  const [edgeForm] = Form.useForm<{ requirement: string }>();

  useEffect(() => {
    dispatch(fetchAiStatusRequest());
  }, [dispatch]);

  useReduxErrorToast(ai.error, !!ai.error);

  // ---------------------------------------------------------------------
  // Streaming state for the Test Cases + Edge Cases tabs.
  // ---------------------------------------------------------------------
  // We keep streaming state OUT of Redux because (a) it changes on every
  // token (would spam selectors) and (b) the structured "parsed" payload
  // is the only thing other tabs care about — and that DOES land in Redux
  // via the regular success actions.

  const [tcStreaming, setTcStreaming] = useState(false);
  const [tcLiveText, setTcLiveText] = useState("");
  const [tcMeta, setTcMeta] = useState<AiStreamMeta | null>(null);
  const tcHandleRef = useRef<AiStreamHandle | null>(null);

  const [edgeStreaming, setEdgeStreaming] = useState(false);
  const [edgeLiveText, setEdgeLiveText] = useState("");
  const [edgeMeta, setEdgeMeta] = useState<AiStreamMeta | null>(null);
  const edgeHandleRef = useRef<AiStreamHandle | null>(null);

  // Cancel in-flight streams when the page unmounts so a navigate-away
  // doesn't leak Socket.IO listeners on the singleton.
  useEffect(() => () => {
    tcHandleRef.current?.abort();
    edgeHandleRef.current?.abort();
  }, []);

  const startTestCasesStream = useCallback(
    (requirement: string, count: number) => {
      tcHandleRef.current?.abort();
      setTcStreaming(true);
      setTcLiveText("");
      setTcMeta(null);
      tcHandleRef.current = aiApi.streamGenerateTestCases(
        { requirement, count },
        {
          onMeta: (m) => setTcMeta(m),
          onToken: (delta) => setTcLiveText((prev) => prev + delta),
          onParsed: (parsed, _raw, usedFallback) => {
            dispatch(
              generateTestCasesSuccess({ items: parsed.items, usedFallback }),
            );
          },
          onError: (msg) => dispatch(aiFailure(msg)),
          onDone: () => setTcStreaming(false),
        },
      );
    },
    [dispatch],
  );

  const startEdgeCasesStream = useCallback(
    (requirement: string) => {
      edgeHandleRef.current?.abort();
      setEdgeStreaming(true);
      setEdgeLiveText("");
      setEdgeMeta(null);
      edgeHandleRef.current = aiApi.streamSuggestEdgeCases(
        { requirement },
        {
          onMeta: (m) => setEdgeMeta(m),
          onToken: (delta) => setEdgeLiveText((prev) => prev + delta),
          onParsed: (parsed, _raw, usedFallback) => {
            dispatch(
              edgeCasesSuccess({ edgeCases: parsed.edgeCases, usedFallback }),
            );
          },
          onError: (msg) => dispatch(aiFailure(msg)),
          onDone: () => setEdgeStreaming(false),
        },
      );
    },
    [dispatch],
  );

  const stopTestCasesStream = () => {
    tcHandleRef.current?.abort();
    setTcStreaming(false);
  };
  const stopEdgeCasesStream = () => {
    edgeHandleRef.current?.abort();
    setEdgeStreaming(false);
  };

  return (
    <div>
      <PageHeader
        title="AI Studio"
        subtitle="Use LLMs to accelerate test design, debugging and coverage."
      />

      {/* LLM-not-configured banner — admins get an actionable link, others a hint. */}
      {ai.status && !ai.status.enabled && (
        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          style={{ marginBottom: 16 }}
          message="AI is running on built-in templates"
          description={
            <Space direction="vertical" size={4}>
              <Text>
                {ai.status.reason ??
                  "No LLM is configured. Outputs below come from deterministic templates, not a real model."}
              </Text>
              {isAdmin ? (
                <Link to={`${ROUTES.SETTINGS}?section=llm`}>Open Settings → LLM</Link>
              ) : (
                <Text type="secondary">Ask an admin to configure the LLM in Settings → LLM.</Text>
              )}
            </Space>
          }
        />
      )}

      {/* LLM ready banner */}
      {ai.status?.enabled && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          style={{ marginBottom: 16 }}
          message={
            <Space size={8} wrap>
              <Text>AI is ready</Text>
              <Tag color="processing">{ai.status.provider}</Tag>
              <Tag>{ai.status.model}</Tag>
              <Tag color={ai.status.source === "db" ? "purple" : "default"}>
                source: {ai.status.source}
              </Tag>
            </Space>
          }
        />
      )}

      {/* Per-request error — also surfaced as a toast via useReduxErrorToast. */}
      {ai.error && (
        <Alert
          type="error"
          showIcon
          closable
          style={{ marginBottom: 16 }}
          message="AI request failed"
          description={ai.error}
        />
      )}

      {/* Last response was a template fallback (LLM call succeeded but parsing failed,
          OR the LLM is disabled and we used the deterministic generator). */}
      {ai.usedFallback && !ai.error && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Showing a template result, not an LLM response"
          description={
            ai.status?.enabled
              ? "The model responded but its output couldn't be parsed cleanly — falling back to a deterministic template."
              : "Configure an LLM in Settings → LLM to get real model output."
          }
        />
      )}

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
                      startTestCasesStream(values.requirement, values.count)
                    }
                  >
                    <Form.Item
                      name="requirement"
                      label="Requirement"
                      rules={[{ required: true, min: 10, message: "At least 10 characters" }]}
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
                    <Space>
                      <Button
                        type="primary"
                        icon={<ThunderboltOutlined />}
                        htmlType="submit"
                        loading={tcStreaming}
                      >
                        {tcStreaming ? "Streaming…" : "Generate test cases"}
                      </Button>
                      {tcStreaming && (
                        <Button icon={<CloseOutlined />} onClick={stopTestCasesStream}>
                          Stop
                        </Button>
                      )}
                    </Space>
                  </Form>

                  {tcStreaming && (
                    <Card
                      size="small"
                      title={
                        <Space size={6} wrap>
                          <ThunderboltOutlined style={{ color: "#06b6d4" }} />
                          <Text strong>Live response</Text>
                          {tcMeta?.provider && <Tag color="processing">{tcMeta.provider}</Tag>}
                          {tcMeta?.model && <Tag>{tcMeta.model}</Tag>}
                        </Space>
                      }
                    >
                      <pre
                        style={{
                          margin: 0,
                          maxHeight: 280,
                          overflow: "auto",
                          whiteSpace: "pre-wrap",
                          fontFamily: "ui-monospace, SFMono-Regular, monospace",
                          fontSize: 12,
                          color: "var(--qf-color-text)",
                        }}
                      >
                        {tcLiveText || "Connecting…"}
                      </pre>
                    </Card>
                  )}

                  {!tcStreaming && ai.generatedTestCases.length > 0 && (
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
                      rules={[{ required: true, min: 10, message: "At least 10 characters" }]}
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
                    onFinish={(values) => startEdgeCasesStream(values.requirement)}
                  >
                    <Form.Item
                      name="requirement"
                      label="Requirement"
                      rules={[{ required: true, min: 10, message: "At least 10 characters" }]}
                    >
                      <Input.TextArea rows={4} />
                    </Form.Item>
                    <Space>
                      <Button
                        type="primary"
                        icon={<ThunderboltOutlined />}
                        htmlType="submit"
                        loading={edgeStreaming}
                      >
                        {edgeStreaming ? "Streaming…" : "Suggest edge cases"}
                      </Button>
                      {edgeStreaming && (
                        <Button icon={<CloseOutlined />} onClick={stopEdgeCasesStream}>
                          Stop
                        </Button>
                      )}
                    </Space>
                  </Form>

                  {edgeStreaming && (
                    <Card
                      size="small"
                      title={
                        <Space size={6} wrap>
                          <ThunderboltOutlined style={{ color: "#f59e0b" }} />
                          <Text strong>Live response</Text>
                          {edgeMeta?.provider && <Tag color="processing">{edgeMeta.provider}</Tag>}
                          {edgeMeta?.model && <Tag>{edgeMeta.model}</Tag>}
                        </Space>
                      }
                    >
                      <pre
                        style={{
                          margin: 0,
                          maxHeight: 220,
                          overflow: "auto",
                          whiteSpace: "pre-wrap",
                          fontFamily: "ui-monospace, SFMono-Regular, monospace",
                          fontSize: 12,
                          color: "var(--qf-color-text)",
                        }}
                      >
                        {edgeLiveText || "Connecting…"}
                      </pre>
                    </Card>
                  )}

                  {!edgeStreaming && ai.edgeCases.length > 0 && (
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
