import {
  BuildOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SaveOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Divider,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type Node,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useState } from "react";

import PageHeader from "@components/common/PageHeader";
import ProjectPicker from "@components/common/ProjectPicker";
import SelectProjectHint from "@components/common/SelectProjectHint";
import { CodeBlock } from "@components/editors";
import { RUNTIME_KIND, nodeTypes, type StepNodeData } from "@components/flowNodes";
import { useAppDispatch, useAppSelector } from "@app/store";
import {
  generateFlowRequest,
  resetAi,
} from "@features/aiGenerator/aiSlice";
import {
  compileRequest,
  fetchListRequest,
  runRequest,
  saveRequest,
  setCurrent,
} from "./flowsSlice";
import type { Flow, FlowInput } from "@apptypes/api";

const { Text, Title } = Typography;

type Runtime = Flow["runtime"];

const PALETTE: Record<Runtime, { type: string; label: string; defaults: Record<string, unknown> }[]> = {
  PLAYWRIGHT: [
    { type: "navigate", label: "Navigate", defaults: { url: "https://example.com" } },
    { type: "click", label: "Click", defaults: { selector: "#submit" } },
    { type: "fill", label: "Fill input", defaults: { selector: "#email", value: "user@x.com" } },
    { type: "wait", label: "Wait", defaults: { ms: 1000 } },
    { type: "assert_text", label: "Assert text", defaults: { selector: "h1", expected: "Welcome" } },
    { type: "screenshot", label: "Screenshot", defaults: { name: "step.png" } },
  ],
  PYTEST_API: [
    { type: "request", label: "HTTP request", defaults: { method: "GET", url: "/api/items" } },
    { type: "assert_status", label: "Assert status", defaults: { expected: 200 } },
    { type: "assert_json", label: "Assert JSON path", defaults: { path: "$.success", expected: true } },
    { type: "set_variable", label: "Set variable", defaults: { name: "token", from: "$.token" } },
  ],
  SQL: [
    { type: "execute_sql", label: "Execute SQL", defaults: { sql: "SELECT 1" } },
    { type: "assert_row_count", label: "Assert row count", defaults: { sql: "SELECT * FROM customers", expected: 1, op: ">=" } },
    { type: "compare", label: "Compare two queries", defaults: { source_sql: "SELECT id FROM s", target_sql: "SELECT id FROM t" } },
  ],
};

type FlowStep = { id: string; type: string; params: Record<string, unknown> };
type FlowDsl = { runtime: Runtime; steps: FlowStep[] };

const buildDsl = (nodes: Node[], edges: Edge[], runtime: Runtime): FlowDsl => {
  const startNode = nodes.find((n) => !edges.some((e) => e.target === n.id));
  const ordered: Node[] = [];
  let current = startNode;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    ordered.push(current);
    const next = edges.find((e) => e.source === current!.id);
    current = next ? nodes.find((n) => n.id === next.target) : undefined;
  }
  if (ordered.length === 0) ordered.push(...nodes);
  return {
    runtime,
    steps: ordered.map((n) => ({
      id: n.id,
      type: (n.data as { stepType?: string })?.stepType || "noop",
      params: ((n.data as { params?: Record<string, unknown> })?.params) || {},
    })),
  };
};

const dslToGraph = (dsl: FlowDsl) => {
  const kind = RUNTIME_KIND[dsl.runtime] ?? "default";
  const nodes: Node[] = dsl.steps.map((step, i) => ({
    id: step.id || `n_${i}`,
    type: "step",
    position: { x: 250, y: 50 + i * 110 },
    data: {
      label: step.type,
      stepType: step.type,
      params: step.params || {},
      kind,
    } satisfies StepNodeData,
  }));
  const edges: Edge[] = dsl.steps.slice(1).map((step, i) => ({
    id: `e_${i}`,
    source: dsl.steps[i].id || `n_${i}`,
    target: step.id || `n_${i + 1}`,
    animated: true,
  }));
  return { nodes, edges };
};

export const NoCodeDesignerPage = () => {
  const dispatch = useAppDispatch();
  const project = useAppSelector((s) => s.projects.selected);
  const flowsState = useAppSelector((s) => s.flows);
  const aiState = useAppSelector((s) => s.ai);
  const { message } = App.useApp();

  const [runtime, setRuntime] = useState<Runtime>("PLAYWRIGHT");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [flowName, setFlowName] = useState("Untitled flow");
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiForm] = Form.useForm<{ scenario: string; runtime: Runtime }>();

  useEffect(() => {
    if (project?.id) dispatch(fetchListRequest(project.id));
  }, [project?.id, dispatch]);

  useEffect(() => {
    if (flowsState.error) message.error(flowsState.error);
  }, [flowsState.error, message]);

  useEffect(() => {
    if (flowsState.lastRunId) {
      message.success(`Run queued: ${flowsState.lastRunId}`);
    }
  }, [flowsState.lastRunId, message]);

  useEffect(() => {
    if (aiState.generatedFlow) {
      const dsl = aiState.generatedFlow as unknown as FlowDsl;
      if (dsl?.steps?.length) {
        setRuntime(dsl.runtime || runtime);
        const { nodes: n, edges: e } = dslToGraph(dsl);
        setNodes(n);
        setEdges(e);
      }
      setAiOpen(false);
      dispatch(resetAi());
    }
  }, [aiState.generatedFlow, dispatch, runtime]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );
  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [],
  );

  const addNode = (item: (typeof PALETTE)[Runtime][number]) => {
    const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const node: Node = {
      id,
      type: "step",
      position: { x: 200 + nodes.length * 30, y: 80 + nodes.length * 60 },
      data: {
        label: item.label,
        stepType: item.type,
        params: { ...item.defaults },
        kind: RUNTIME_KIND[runtime] ?? "default",
      } satisfies StepNodeData,
    };
    setNodes((nds) => [...nds, node]);
  };

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );

  const updateNodeParam = (key: string, value: unknown) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId
          ? {
              ...n,
              data: {
                ...n.data,
                params: { ...((n.data as { params?: Record<string, unknown> }).params || {}), [key]: value },
              },
            }
          : n,
      ),
    );
  };

  const flowDsl = useMemo(() => buildDsl(nodes, edges, runtime), [nodes, edges, runtime]);

  const onSave = () => {
    if (!project) return;
    const data: FlowInput = {
      name: flowName,
      runtime,
      flow_json: flowDsl as unknown as Record<string, unknown>,
    };
    dispatch(saveRequest({ projectId: project.id, flowId: selectedFlowId || undefined, data }));
  };

  const currentFlowId = flowsState.current?.id;
  useEffect(() => {
    if (currentFlowId && currentFlowId !== selectedFlowId) {
      setSelectedFlowId(currentFlowId);
    }
  }, [currentFlowId, selectedFlowId]);

  const onCompile = () => {
    if (!selectedFlowId) {
      message.warning("Save the flow first");
      return;
    }
    dispatch(compileRequest(selectedFlowId));
  };

  const onRun = () => {
    if (!selectedFlowId) {
      message.warning("Save the flow first");
      return;
    }
    dispatch(runRequest(selectedFlowId));
  };

  const loadFlow = (flow: Flow) => {
    dispatch(setCurrent(flow));
    setSelectedFlowId(flow.id);
    setFlowName(flow.name);
    setRuntime(flow.runtime);
    const dsl = flow.flow_json as unknown as FlowDsl;
    if (dsl?.steps?.length) {
      const { nodes: n, edges: e } = dslToGraph(dsl);
      setNodes(n);
      setEdges(e);
    } else {
      setNodes([]);
      setEdges([]);
    }
  };

  const newFlow = () => {
    dispatch(setCurrent(null));
    setSelectedFlowId(null);
    setFlowName("Untitled flow");
    setNodes([]);
    setEdges([]);
  };

  const onAiGenerate = async () => {
    const values = await aiForm.validateFields();
    setRuntime(values.runtime);
    dispatch(generateFlowRequest({ scenario: values.scenario }));
  };

  return (
    <div>
      <PageHeader
        title="No-Code Test Designer"
        subtitle="Drag, drop and connect steps to build executable test flows."
        actions={
          <Space>
            <ProjectPicker />
            <Button
              icon={<ThunderboltOutlined />}
              onClick={() => {
                aiForm.setFieldsValue({ runtime, scenario: "" });
                setAiOpen(true);
              }}
            >
              AI Flow
            </Button>
            <Button icon={<PlusOutlined />} onClick={newFlow}>
              New
            </Button>
            <Button
              icon={<SaveOutlined />}
              loading={flowsState.saving}
              disabled={!project}
              onClick={onSave}
            >
              Save
            </Button>
            <Button icon={<BuildOutlined />} onClick={onCompile} disabled={!selectedFlowId}>
              Compile
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={onRun}
              disabled={!selectedFlowId}
            >
              Run
            </Button>
          </Space>
        }
      />

      {!project && (
        <SelectProjectHint message="Select a project to design and run flows." />
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr 340px",
          gap: 16,
          minHeight: 600,
        }}
      >
        <Card styles={{ body: { padding: 16, maxHeight: 720, overflow: "auto" } }}>
          <Text type="secondary" style={{ fontSize: 11, letterSpacing: 0.5 }}>
            RUNTIME
          </Text>
          <Segmented
            value={runtime}
            onChange={(v) => setRuntime(v as Runtime)}
            block
            options={[
              { label: "UI", value: "PLAYWRIGHT" },
              { label: "API", value: "PYTEST_API" },
              { label: "SQL", value: "SQL" },
            ]}
            style={{ margin: "8px 0 16px" }}
          />

          <Text type="secondary" style={{ fontSize: 11, letterSpacing: 0.5 }}>
            STEPS
          </Text>
          <Space direction="vertical" style={{ width: "100%", marginTop: 8 }} size={6}>
            {PALETTE[runtime].map((item) => (
              <Button
                key={item.type}
                icon={<PlusOutlined />}
                onClick={() => addNode(item)}
                block
                style={{ justifyContent: "flex-start" }}
              >
                {item.label}
              </Button>
            ))}
          </Space>

          <Divider />
          <Text type="secondary" style={{ fontSize: 11, letterSpacing: 0.5 }}>
            SAVED FLOWS
          </Text>
          {flowsState.items.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No saved flows"
              style={{ marginTop: 12 }}
            />
          ) : (
            <List
              size="small"
              style={{ marginTop: 8 }}
              dataSource={flowsState.items}
              renderItem={(f) => (
                <List.Item
                  onClick={() => loadFlow(f)}
                  style={{
                    cursor: "pointer",
                    background: f.id === selectedFlowId ? "rgba(99,102,241,0.08)" : "transparent",
                    borderRadius: 6,
                    padding: "6px 8px",
                  }}
                >
                  <List.Item.Meta
                    title={<Text>{f.name}</Text>}
                    description={<Tag>{f.runtime}</Tag>}
                  />
                </List.Item>
              )}
            />
          )}
        </Card>

        <Card
          styles={{ body: { padding: 0, height: 720, display: "flex", flexDirection: "column" } }}
        >
          <Space style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
            <Input
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              style={{ width: 260 }}
            />
            <Tag color="processing">{runtime}</Tag>
          </Space>
          <div style={{ flex: 1 }}>
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={(_, n) => setSelectedNodeId(n.id)}
                onPaneClick={() => setSelectedNodeId(null)}
                fitView
              >
                <Background />
                <Controls />
                <MiniMap />
              </ReactFlow>
            </ReactFlowProvider>
          </div>
        </Card>

        <Card styles={{ body: { padding: 16, maxHeight: 720, overflow: "auto" } }}>
          <Text type="secondary" style={{ fontSize: 11, letterSpacing: 0.5 }}>
            STEP PROPERTIES
          </Text>
          {!selectedNode && (
            <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
              Click a step in the canvas to edit its parameters.
            </Text>
          )}
          {selectedNode && (
            <Space direction="vertical" style={{ width: "100%", marginTop: 8 }} size={10}>
              <Tag color="processing">{(selectedNode.data as { stepType?: string }).stepType}</Tag>
              {Object.entries(
                ((selectedNode.data as { params?: Record<string, unknown> }).params) || {},
              ).map(([k, v]) => (
                <Form.Item key={k} label={k} style={{ marginBottom: 8 }}>
                  <Input
                    value={String(v ?? "")}
                    onChange={(e) => updateNodeParam(k, e.target.value)}
                  />
                </Form.Item>
              ))}
            </Space>
          )}

          <Divider />
          <Text type="secondary" style={{ fontSize: 11, letterSpacing: 0.5 }}>
            COMPILED SCRIPT
          </Text>
          <div style={{ marginTop: 8 }}>
            <CodeBlock
              code={
                flowsState.compiled?.script ||
                "// Save and click Compile to generate the executable script."
              }
              language={runtime === "SQL" ? "sql" : runtime === "PYTEST_API" ? "python" : "ts"}
              maxHeight={240}
            />
          </div>
          {(flowsState.compiled?.warnings?.length ?? 0) > 0 && (
            <Alert
              style={{ marginTop: 12 }}
              type="warning"
              showIcon
              message={
                <Space direction="vertical" size={2}>
                  {flowsState.compiled?.warnings.map((w, i) => (
                    <Text key={i}>{w}</Text>
                  ))}
                </Space>
              }
            />
          )}
        </Card>
      </div>

      <Modal
        title="Generate flow with AI"
        open={aiOpen}
        onCancel={() => setAiOpen(false)}
        onOk={onAiGenerate}
        confirmLoading={aiState.loading}
        okText="Generate"
        okButtonProps={{ icon: <ThunderboltOutlined /> }}
        destroyOnClose
      >
        <Form<{ scenario: string; runtime: Runtime }>
          form={aiForm}
          layout="vertical"
          initialValues={{ runtime }}
        >
          <Title level={5} style={{ margin: "0 0 8px" }}>
            Describe what the test should do
          </Title>
          <Form.Item name="scenario" rules={[{ required: true }]}>
            <Input.TextArea
              rows={5}
              placeholder="Login with valid credentials, navigate to settings, change password..."
            />
          </Form.Item>
          <Form.Item name="runtime" label="Runtime">
            <Select
              options={[
                { value: "PLAYWRIGHT", label: "UI (Playwright)" },
                { value: "PYTEST_API", label: "API (Pytest)" },
                { value: "SQL", label: "SQL" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default NoCodeDesignerPage;
