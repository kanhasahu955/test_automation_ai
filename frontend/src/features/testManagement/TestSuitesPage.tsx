import {
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";

import PageHeader from "@components/common/PageHeader";
import ProjectPicker from "@components/common/ProjectPicker";
import SelectProjectHint from "@components/common/SelectProjectHint";
import { ROUTES } from "@constants/routes";
import { useAppSelector } from "@app/store";
import useSelectedProject from "@hooks/useSelectedProject";
import { environmentsApi } from "@services/environmentsApi";
import { testCaseApi } from "@services/testCaseApi";
import {
  testSuiteApi,
  type SuiteCase,
  type SuiteType,
  type TestSuite,
} from "@services/testSuiteApi";
import { getApiErrorMessage } from "@utils/apiErrors";

const { Text } = Typography;

const SUITE_TYPES: SuiteType[] = ["SMOKE", "REGRESSION", "SANITY", "CUSTOM"];

const canQa = (role: string | undefined) =>
  role === "ADMIN" || role === "QA_MANAGER" || role === "QA_ENGINEER";

export const TestSuitesPage = () => {
  const { projectId, hasProject } = useSelectedProject();
  const role = useAppSelector((s) => s.auth.user?.role);
  const canWrite = canQa(role);
  const { message } = App.useApp();

  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createForm] = Form.useForm<{ name: string; description?: string; suite_type: SuiteType }>();

  const [runSuite, setRunSuite] = useState<TestSuite | null>(null);
  const [runSaving, setRunSaving] = useState(false);
  const [runForm] = Form.useForm<{ environment_id?: string | null }>();
  const [envs, setEnvs] = useState<{ id: string; name: string }[]>([]);

  const [manageSuite, setManageSuite] = useState<TestSuite | null>(null);
  const [cases, setCases] = useState<SuiteCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [testCaseMap, setTestCaseMap] = useState<Record<string, string>>({});
  const [addForm] = Form.useForm<{ test_case_id: string; execution_order: number }>();
  const [addSaving, setAddSaving] = useState(false);

  const loadSuites = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await testSuiteApi.list(projectId);
      setSuites(data);
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to load test suites"));
    } finally {
      setLoading(false);
    }
  }, [projectId, message]);

  useEffect(() => {
    void loadSuites();
  }, [loadSuites]);

  const openRun = async (suite: TestSuite) => {
    setRunSuite(suite);
    runForm.resetFields();
    if (!projectId) return;
    try {
      const list = await environmentsApi.listByProject(projectId);
      setEnvs(list.map((e) => ({ id: e.id, name: e.name })));
    } catch {
      setEnvs([]);
    }
  };

  const submitRun = async () => {
    if (!runSuite) return;
    const v = await runForm.validateFields();
    setRunSaving(true);
    try {
      const run = await testSuiteApi.run(runSuite.id, {
        environment_id: v.environment_id || null,
        triggered_by_label: "manual",
      });
      message.success(
        <span>
          Run queued: <Text code>{run.id.slice(0, 8)}…</Text> —{" "}
          <Link to={ROUTES.EXECUTIONS}>open executions</Link>
        </span>,
      );
      setRunSuite(null);
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to start suite run"));
    } finally {
      setRunSaving(false);
    }
  };

  const openManage = async (suite: TestSuite) => {
    setManageSuite(suite);
    setCases([]);
    setTestCaseMap({});
    if (!projectId) return;
    setCasesLoading(true);
    try {
      const [caseRows, tcPage] = await Promise.all([
        testSuiteApi.listCases(suite.id),
        testCaseApi.list(projectId, 1, 200),
      ]);
      setCases(caseRows);
      const map: Record<string, string> = {};
      for (const t of tcPage.items) map[t.id] = t.title;
      setTestCaseMap(map);
      addForm.setFieldsValue({
        execution_order:
          caseRows.length > 0 ? Math.max(...caseRows.map((c) => c.execution_order)) + 1 : 1,
      });
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to load suite cases"));
    } finally {
      setCasesLoading(false);
    }
  };

  const refreshCases = async (suiteId: string) => {
    setCasesLoading(true);
    try {
      const caseRows = await testSuiteApi.listCases(suiteId);
      setCases(caseRows);
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to refresh cases"));
    } finally {
      setCasesLoading(false);
    }
  };

  const onAddCase = async () => {
    if (!manageSuite) return;
    const v = await addForm.validateFields();
    setAddSaving(true);
    try {
      await testSuiteApi.addCase(manageSuite.id, {
        test_case_id: v.test_case_id,
        execution_order: v.execution_order,
      });
      message.success("Test case added to suite");
      addForm.setFieldsValue({ test_case_id: undefined });
      void refreshCases(manageSuite.id);
      void loadSuites();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to add case"));
    } finally {
      setAddSaving(false);
    }
  };

  const onRemoveCase = async (link: SuiteCase) => {
    if (!manageSuite) return;
    try {
      await testSuiteApi.removeCase(manageSuite.id, link.id);
      message.success("Removed from suite");
      void refreshCases(manageSuite.id);
      void loadSuites();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to remove case"));
    }
  };

  const onCreateSuite = async () => {
    if (!projectId) return;
    const v = await createForm.validateFields();
    setCreateSaving(true);
    try {
      await testSuiteApi.create(projectId, v);
      message.success("Suite created");
      setCreateOpen(false);
      createForm.resetFields();
      void loadSuites();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to create suite"));
    } finally {
      setCreateSaving(false);
    }
  };

  const caseOptions = useMemo(() => {
    if (!projectId) return [];
    const inSuite = new Set(cases.map((c) => c.test_case_id));
    return Object.entries(testCaseMap)
      .filter(([id]) => !inSuite.has(id))
      .map(([id, title]) => ({ value: id, label: title || id }));
  }, [testCaseMap, projectId, cases]);

  const suiteColumns: ColumnsType<TestSuite> = [
    {
      title: "Name",
      dataIndex: "name",
      render: (name: string, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          {r.description && <Text type="secondary" className="!text-xs">{r.description}</Text>}
        </Space>
      ),
    },
    {
      title: "Type",
      dataIndex: "suite_type",
      width: 120,
      render: (t: string | null) => (t ? <Tag>{t}</Tag> : "—"),
    },
    { title: "Cases", dataIndex: "case_count", width: 90 },
    {
      title: "Created",
      dataIndex: "created_at",
      width: 180,
      render: (d: string | null) => (d ? new Date(d).toLocaleString() : "—"),
    },
    {
      title: "Actions",
      key: "actions",
      width: 220,
      render: (_: unknown, r) => (
        <Space wrap>
          <Button size="small" icon={<ThunderboltOutlined />} onClick={() => void openRun(r)}>
            Run
          </Button>
          <Button size="small" icon={<UnorderedListOutlined />} onClick={() => void openManage(r)}>
            Cases
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="min-w-0">
      <PageHeader
        title="Test suites"
        subtitle="Group test cases for smoke, regression, and release runs. Runs create execution records you can follow on the Executions page."
        actions={
          <Space wrap>
            <ProjectPicker />
            {canWrite && hasProject && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
                New suite
              </Button>
            )}
            <Button icon={<ReloadOutlined />} onClick={() => void loadSuites()} disabled={!hasProject}>
              Refresh
            </Button>
          </Space>
        }
      />

      {!hasProject && <SelectProjectHint message="Select a project to view and manage test suites." />}

      <Table<TestSuite>
        rowKey="id"
        loading={loading}
        columns={suiteColumns}
        dataSource={suites}
        pagination={{ pageSize: 12, showSizeChanger: true }}
        scroll={{ x: "max-content" }}
      />

      <Modal
        title="New test suite"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={onCreateSuite}
        confirmLoading={createSaving}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" initialValues={{ suite_type: "CUSTOM" as SuiteType }}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Release regression" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="suite_type" label="Suite type" rules={[{ required: true }]}>
            <Select options={SUITE_TYPES.map((t) => ({ value: t, label: t }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={runSuite ? `Run: ${runSuite.name}` : "Run suite"}
        open={!!runSuite}
        onCancel={() => setRunSuite(null)}
        onOk={submitRun}
        confirmLoading={runSaving}
        destroyOnClose
      >
        <Form form={runForm} layout="vertical">
          <Form.Item name="environment_id" label="Environment (optional)">
            <Select
              allowClear
              placeholder="Default / no environment"
              options={envs.map((e) => ({ value: e.id, label: e.name }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        </Form>
        <Text type="secondary" className="!text-sm">
          A new execution run is created for every case in the suite (when cases exist; empty suites may report zero tests).
        </Text>
      </Modal>

      <Modal
        title={manageSuite ? `Cases in: ${manageSuite.name}` : "Suite cases"}
        open={!!manageSuite}
        onCancel={() => setManageSuite(null)}
        footer={null}
        width={720}
        destroyOnClose
      >
        {canWrite && (
          <Form layout="inline" className="mb-4" form={addForm} onFinish={() => void onAddCase()}>
            <Form.Item
              name="test_case_id"
              rules={[{ required: true, message: "Pick a test" }]}
              className="!mb-2 min-w-[200px] flex-1"
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Test case"
                options={caseOptions}
              />
            </Form.Item>
            <Form.Item name="execution_order" label="Order" initialValue={1}>
              <InputNumber min={1} className="!w-24" />
            </Form.Item>
            <Form.Item className="!mb-2">
              <Button type="primary" htmlType="submit" loading={addSaving} icon={<PlusOutlined />}>
                Add
              </Button>
            </Form.Item>
          </Form>
        )}
        <Table<SuiteCase>
          size="small"
          rowKey="id"
          loading={casesLoading}
          dataSource={cases}
          pagination={false}
          columns={(
            [
              { title: "Order", dataIndex: "execution_order", width: 80 },
              {
                title: "Test case",
                dataIndex: "test_case_id",
                render: (id: string) => testCaseMap[id] || <Text code>{id}</Text>,
              },
            ] as ColumnsType<SuiteCase>
          ).concat(
            canWrite
              ? [
                  {
                    title: "",
                    key: "rm",
                    width: 64,
                    render: (_: unknown, link: SuiteCase) => (
                      <Popconfirm title="Remove from suite?" onConfirm={() => void onRemoveCase(link)}>
                        <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                      </Popconfirm>
                    ),
                  },
                ]
              : [],
          )}
        />
      </Modal>
    </div>
  );
};

export default TestSuitesPage;
