import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  ExclamationCircleOutlined,
  FundProjectionScreenOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Progress,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";

import { JsonView } from "@components/editors";
import { DataTable } from "@components/tables";
import PageHeader from "@components/common/PageHeader";
import ProjectPicker from "@components/common/ProjectPicker";
import SelectProjectHint from "@components/common/SelectProjectHint";
import StatCard from "@components/common/StatCard";

import useSelectedProject from "@hooks/useSelectedProject";
import { dataSourcesApi, type DataSource } from "@services/dataSourcesApi";
import {
  profilingApi,
  type ProfilingRun,
  type ProfilingStatus,
} from "@services/profilingApi";
import { tokens } from "@theme/tokens";
import { getApiErrorMessage } from "@utils/apiErrors";

const { Text } = Typography;

const STATUS_COLOR: Record<ProfilingStatus, string> = {
  PENDING: "default",
  RUNNING: "processing",
  COMPLETED: "success",
  FAILED: "error",
};

const STATUS_ICON: Record<ProfilingStatus, ReactElement> = {
  PENDING: <ClockCircleOutlined />,
  RUNNING: <ThunderboltOutlined />,
  COMPLETED: <CheckCircleOutlined />,
  FAILED: <ExclamationCircleOutlined />,
};

const toQualityPercent = (value: number | string | null | undefined): number => {
  if (value == null) return 0;
  const numeric = typeof value === "string" ? Number.parseFloat(value) : value;
  if (Number.isNaN(numeric)) return 0;
  if (numeric <= 1) return Math.round(numeric * 100);
  return Math.min(100, Math.round(numeric));
};

const formatDuration = (run: ProfilingRun): string => {
  if (!run.started_at || !run.finished_at) return "—";
  const ms =
    new Date(run.finished_at).getTime() - new Date(run.started_at).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";
  if (ms < 1_000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)} s`;
  return `${Math.round(ms / 60_000)} min`;
};

export const DataProfilingPage = () => {
  const { project, projectId } = useSelectedProject();
  const { message } = App.useApp();

  const [sources, setSources] = useState<DataSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  const [runs, setRuns] = useState<ProfilingRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const [activeRun, setActiveRun] = useState<ProfilingRun | null>(null);

  const loadSources = useCallback(
    async (id: string) => {
      setSourcesLoading(true);
      try {
        const data = await dataSourcesApi.list(id);
        setSources(data);
        if (data.length > 0 && !selectedSourceId) {
          setSelectedSourceId(data[0].id);
        }
      } catch (err) {
        message.error(getApiErrorMessage(err, "Failed to load data sources"));
      } finally {
        setSourcesLoading(false);
      }
    },
    [message, selectedSourceId],
  );

  const loadRuns = useCallback(
    async (id: string) => {
      setRunsLoading(true);
      try {
        const data = await profilingApi.list(id);
        setRuns(data);
      } catch (err) {
        message.error(getApiErrorMessage(err, "Failed to load profiling runs"));
      } finally {
        setRunsLoading(false);
      }
    },
    [message],
  );

  useEffect(() => {
    if (projectId) {
      void loadSources(projectId);
      void loadRuns(projectId);
    } else {
      setSources([]);
      setRuns([]);
      setSelectedSourceId(null);
    }
  }, [projectId, loadSources, loadRuns]);

  const trigger = async () => {
    if (!selectedSourceId) return;
    setTriggering(true);
    try {
      const run = await profilingApi.trigger(selectedSourceId);
      message.success("Profiling run queued.");
      setRuns((prev) => [run, ...prev]);
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to queue profiling run"));
    } finally {
      setTriggering(false);
    }
  };

  const stats = useMemo(() => {
    const total = runs.length;
    const completed = runs.filter((r) => r.status === "COMPLETED").length;
    const running = runs.filter((r) => r.status === "RUNNING" || r.status === "PENDING")
      .length;
    const failed = runs.filter((r) => r.status === "FAILED").length;
    const completedScored = runs.filter(
      (r) => r.status === "COMPLETED" && r.overall_quality_score != null,
    );
    const avg =
      completedScored.length > 0
        ? completedScored.reduce(
            (sum, r) => sum + toQualityPercent(r.overall_quality_score),
            0,
          ) / completedScored.length
        : 0;
    return { total, completed, running, failed, avg: Math.round(avg) };
  }, [runs]);

  const sourceById = useMemo(
    () => Object.fromEntries(sources.map((s) => [s.id, s])),
    [sources],
  );

  const columns: ColumnsType<ProfilingRun> = [
    {
      title: "Status",
      dataIndex: "status",
      width: 140,
      render: (s: ProfilingStatus) => (
        <Tag color={STATUS_COLOR[s]} icon={STATUS_ICON[s]}>
          {s}
        </Tag>
      ),
      filters: (Object.keys(STATUS_COLOR) as ProfilingStatus[]).map((s) => ({
        text: s,
        value: s,
      })),
      onFilter: (value, record) => record.status === value,
    },
    {
      title: "Data source",
      dataIndex: "data_source_id",
      render: (id: string) => {
        const ds = sourceById[id];
        return ds ? (
          <Space size={6}>
            <DatabaseOutlined style={{ color: tokens.color.primary }} />
            <Text strong>{ds.name}</Text>
            <Tag color="default">{ds.source_type}</Tag>
          </Space>
        ) : (
          <Text type="secondary">{id.slice(0, 8)}…</Text>
        );
      },
    },
    {
      title: "Quality",
      dataIndex: "overall_quality_score",
      width: 200,
      render: (v: number | string | null | undefined, record) => {
        if (record.status !== "COMPLETED") return <Text type="secondary">—</Text>;
        const pct = toQualityPercent(v);
        return (
          <Progress
            percent={pct}
            size="small"
            status={pct >= 80 ? "success" : pct >= 50 ? "active" : "exception"}
          />
        );
      },
      sorter: (a, b) =>
        toQualityPercent(a.overall_quality_score) -
        toQualityPercent(b.overall_quality_score),
    },
    {
      title: "Duration",
      key: "duration",
      width: 120,
      render: (_, run) => formatDuration(run),
    },
    {
      title: "Started",
      dataIndex: "started_at",
      width: 180,
      render: (v: string | null | undefined, record) =>
        v
          ? new Date(v).toLocaleString()
          : record.created_at
            ? new Date(record.created_at).toLocaleString()
            : "—",
      sorter: (a, b) => {
        const ax = new Date(a.started_at || a.created_at || 0).getTime();
        const bx = new Date(b.started_at || b.created_at || 0).getTime();
        return ax - bx;
      },
      defaultSortOrder: "descend",
    },
    {
      title: "",
      key: "open",
      width: 90,
      align: "right",
      render: (_, run) => (
        <Button type="link" onClick={() => setActiveRun(run)}>
          Detail
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Data Profiling"
        subtitle="Profile any connection — see distributions, nulls and anomalies, and track quality over time."
        actions={<ProjectPicker />}
      />

      {!project && (
        <SelectProjectHint message="Select a project to run and review profiling jobs." />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <StatCard
            title="Total runs"
            value={stats.total}
            hint="All-time profiling jobs"
            icon={<FundProjectionScreenOutlined />}
            accent={tokens.color.primary}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            title="Avg quality"
            value={`${stats.avg}%`}
            hint="Across completed runs"
            icon={<CheckCircleOutlined />}
            accent="#22c55e"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            title="In flight"
            value={stats.running}
            hint="Pending or running"
            icon={<ThunderboltOutlined />}
            accent="#f59e0b"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            title="Failed"
            value={stats.failed}
            hint="Investigate the latest"
            icon={<ExclamationCircleOutlined />}
            accent="#ef4444"
          />
        </Col>
      </Row>

      <Card
        title="Profiling runs"
        extra={
          <Space wrap>
            <Select
              placeholder="Pick a connection"
              loading={sourcesLoading}
              style={{ minWidth: 240 }}
              value={selectedSourceId ?? undefined}
              onChange={(v) => setSelectedSourceId(v)}
              options={sources.map((s) => ({
                label: `${s.name} (${s.source_type})`,
                value: s.id,
              }))}
              disabled={!project}
            />
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={trigger}
              loading={triggering}
              disabled={!selectedSourceId}
            >
              Run profile
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => projectId && loadRuns(projectId)}
              loading={runsLoading}
              disabled={!projectId}
            >
              Refresh
            </Button>
          </Space>
        }
      >
        {!project ? (
          <Empty description="Pick a project to see profiling runs." />
        ) : (
          <DataTable<ProfilingRun>
            data={runs}
            columns={columns}
            rowKey="id"
            loading={runsLoading}
            emptyDescription="No profiling runs yet — pick a connection and click Run profile."
            pagination={{ pageSize: 20, showSizeChanger: true }}
          />
        )}
      </Card>

      <Drawer
        title={
          activeRun ? (
            <Space>
              <FundProjectionScreenOutlined />
              <Text strong>Profiling run</Text>
              <Tag color={STATUS_COLOR[activeRun.status]} icon={STATUS_ICON[activeRun.status]}>
                {activeRun.status}
              </Tag>
            </Space>
          ) : (
            "Run details"
          )
        }
        open={!!activeRun}
        onClose={() => setActiveRun(null)}
        width={720}
        destroyOnHidden
      >
        {activeRun && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Run id" span={2}>
                <Text code>{activeRun.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Data source">
                {sourceById[activeRun.data_source_id]?.name || activeRun.data_source_id}
              </Descriptions.Item>
              <Descriptions.Item label="Quality score">
                {activeRun.status === "COMPLETED" ? (
                  <Progress
                    percent={toQualityPercent(activeRun.overall_quality_score)}
                    size="small"
                    status={
                      toQualityPercent(activeRun.overall_quality_score) >= 80
                        ? "success"
                        : "active"
                    }
                  />
                ) : (
                  "—"
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Started">
                {activeRun.started_at
                  ? new Date(activeRun.started_at).toLocaleString()
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Finished">
                {activeRun.finished_at
                  ? new Date(activeRun.finished_at).toLocaleString()
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Duration" span={2}>
                {formatDuration(activeRun)}
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title="Summary">
              {activeRun.summary_json ? (
                <JsonView value={activeRun.summary_json} title="summary_json" maxHeight={420} />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    activeRun.status === "COMPLETED"
                      ? "Run completed without a summary payload."
                      : "Summary will appear once the run completes."
                  }
                />
              )}
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default DataProfilingPage;
