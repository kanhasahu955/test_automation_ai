import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  ExperimentOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Empty,
  List,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo } from "react";

import StatCard from "@components/common/StatCard";
import TrendBarChart, { type TrendPoint } from "@components/charts/TrendBarChart";
import PageHeader from "@components/common/PageHeader";
import ProjectPicker from "@components/common/ProjectPicker";
import SelectProjectHint from "@components/common/SelectProjectHint";
import { useAppDispatch, useAppSelector } from "@app/store";
import {
  fetchReportRequest,
  fetchRunsRequest,
  selectRun,
} from "@features/executions/executionsSlice";
import { useSelectedProject } from "@hooks/useSelectedProject";
import { tokens } from "@theme/tokens";
import { executionStatusColor, type ExecutionStatus } from "@utils/executionStatus";
import type { ExecutionResult, ExecutionRun } from "@services/executionApi";

const { Text, Paragraph } = Typography;

const formatDuration = (ms: number | null | undefined): string => {
  if (ms == null || Number.isNaN(ms)) return "—";
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)} m`;
  return `${(minutes / 60).toFixed(1)} h`;
};

const passRate = (run: ExecutionRun): number => {
  const total = run.total_tests || 0;
  if (total === 0) return 0;
  return Math.round((run.passed_tests / total) * 100);
};

const finishedRunDurationMs = (run: ExecutionRun): number | null => {
  if (!run.started_at || !run.finished_at) return null;
  const started = new Date(run.started_at).getTime();
  const finished = new Date(run.finished_at).getTime();
  if (Number.isNaN(started) || Number.isNaN(finished)) return null;
  return Math.max(0, finished - started);
};

/**
 * Rich reports view: KPI strip + last-30-runs trend chart on top, then the
 * existing run list and run details.
 */
export const ReportsPage = () => {
  const dispatch = useAppDispatch();
  const { projectId, hasProject } = useSelectedProject();
  const { runs, loading, selectedRunId, report, reportLoading } = useAppSelector(
    (s) => s.executions,
  );

  useEffect(() => {
    if (projectId) dispatch(fetchRunsRequest(projectId));
  }, [projectId, dispatch]);

  useEffect(() => {
    if (selectedRunId) dispatch(fetchReportRequest(selectedRunId));
  }, [selectedRunId, dispatch]);

  const refresh = () => {
    if (projectId) dispatch(fetchRunsRequest(projectId));
  };

  const kpis = useMemo(() => {
    const finished = runs.filter(
      (r) => r.status === "PASSED" || r.status === "FAILED",
    );
    const totals = finished.reduce(
      (acc, r) => {
        acc.total += r.total_tests || 0;
        acc.passed += r.passed_tests || 0;
        acc.failed += r.failed_tests || 0;
        acc.skipped += r.skipped_tests || 0;
        const dur = finishedRunDurationMs(r);
        if (dur != null) {
          acc.durationSum += dur;
          acc.durationCount += 1;
        }
        return acc;
      },
      { total: 0, passed: 0, failed: 0, skipped: 0, durationSum: 0, durationCount: 0 },
    );
    const passPct = totals.total === 0 ? 0 : Math.round((totals.passed / totals.total) * 100);
    return {
      runCount: runs.length,
      finishedCount: finished.length,
      total: totals.total,
      passed: totals.passed,
      failed: totals.failed,
      skipped: totals.skipped,
      passPct,
      avgDurationMs:
        totals.durationCount === 0 ? null : Math.round(totals.durationSum / totals.durationCount),
    };
  }, [runs]);

  /** Aggregate last-N runs into a chronological trend, oldest → newest. */
  const trend: TrendPoint[] = useMemo(() => {
    const recent = [...runs]
      .filter((r) => r.started_at)
      .sort(
        (a, b) =>
          new Date(a.started_at as string).getTime() -
          new Date(b.started_at as string).getTime(),
      )
      .slice(-20);
    return recent.map((r) => ({
      label: new Date(r.started_at as string).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      passed: r.passed_tests,
      failed: r.failed_tests,
      skipped: r.skipped_tests,
    }));
  }, [runs]);

  const runColumns: ColumnsType<ExecutionRun> = [
    {
      title: "Run",
      dataIndex: "id",
      render: (id: string, run) => (
        <Space direction="vertical" size={0}>
          <Text code style={{ fontSize: 12 }}>
            {id.slice(0, 8)}
          </Text>
          {run.started_at && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {new Date(run.started_at).toLocaleString()}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 110,
      render: (s: string) => (
        <Tag color={executionStatusColor(s as ExecutionStatus)}>{s}</Tag>
      ),
    },
    {
      title: "Pass rate",
      key: "pass_rate",
      width: 130,
      render: (_v, run) => {
        const pct = passRate(run);
        const color =
          pct >= 90
            ? tokens.color.success
            : pct >= 60
              ? tokens.color.warning
              : tokens.color.danger;
        return (
          <Space direction="vertical" size={0}>
            <Text strong style={{ color }}>
              {pct}%
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {run.passed_tests}/{run.total_tests}
            </Text>
          </Space>
        );
      },
    },
    { title: "Type", dataIndex: "run_type", width: 110 },
  ];

  const resultColumns: ColumnsType<ExecutionResult> = [
    {
      title: "Test",
      key: "test",
      render: (_, r) => (
        <Space size={4}>
          <Text strong>
            {r.test_name || r.flow_name || (r.test_case_id?.slice(0, 8) ?? "—")}
          </Text>
          {r.flow_name && !r.test_name && <Tag color="purple">flow</Tag>}
        </Space>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 110,
      render: (s: string) => (
        <Tag color={executionStatusColor(s as ExecutionStatus)}>{s}</Tag>
      ),
    },
    {
      title: "Duration",
      dataIndex: "duration_ms",
      width: 110,
      render: (v: number) => formatDuration(v),
    },
    { title: "Error", dataIndex: "error_message", ellipsis: true },
  ];

  const exportSelectedReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `qf-run-${report.run.id.slice(0, 8)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Execution Reports"
        subtitle="Drill into runs, see failures, durations and AI-suggested fixes."
        actions={
          <Space>
            <ProjectPicker />
            <Button
              icon={<ReloadOutlined />}
              onClick={refresh}
              loading={loading}
              disabled={!hasProject}
            >
              Refresh
            </Button>
          </Space>
        }
      />

      {!hasProject && (
        <SelectProjectHint message="Select a project to view execution history." />
      )}

      {hasProject && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12} md={6}>
              <StatCard
                title="Runs"
                value={kpis.runCount}
                icon={<ExperimentOutlined />}
                accent={tokens.color.primary}
                hint={`${kpis.finishedCount} finished`}
              />
            </Col>
            <Col xs={12} md={6}>
              <StatCard
                title="Pass rate"
                value={`${kpis.passPct}%`}
                icon={<CheckCircleOutlined />}
                accent={tokens.color.success}
                hint={`${kpis.passed.toLocaleString()} of ${kpis.total.toLocaleString()} tests`}
              />
            </Col>
            <Col xs={12} md={6}>
              <StatCard
                title="Failures"
                value={kpis.failed.toLocaleString()}
                icon={<CloseCircleOutlined />}
                accent={tokens.color.danger}
                hint={`${kpis.skipped.toLocaleString()} skipped`}
              />
            </Col>
            <Col xs={12} md={6}>
              <StatCard
                title="Avg duration"
                value={formatDuration(kpis.avgDurationMs)}
                icon={<ClockCircleOutlined />}
                accent={tokens.color.warning}
                hint="Average finished run time"
              />
            </Col>
          </Row>

          <Card
            title="Pass / fail trend"
            style={{ marginBottom: 16 }}
            styles={{ body: { padding: trend.length === 0 ? 24 : 16, height: 280 } }}
          >
            {trend.length === 0 ? (
              <Empty description="Run something to see a trend." />
            ) : (
              <TrendBarChart data={trend} />
            )}
          </Card>
        </>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card title="Recent runs" loading={loading && runs.length === 0}>
            <Table<ExecutionRun>
              rowKey="id"
              dataSource={runs}
              columns={runColumns}
              size="small"
              pagination={{ pageSize: 10 }}
              onRow={(row) => ({
                onClick: () => dispatch(selectRun(row.id)),
                style: {
                  cursor: "pointer",
                  background: row.id === selectedRunId ? "rgba(99,102,241,0.08)" : undefined,
                },
              })}
              locale={{ emptyText: "No runs yet." }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card
            title="Run details"
            loading={reportLoading}
            extra={
              report ? (
                <Button
                  type="text"
                  icon={<DownloadOutlined />}
                  onClick={exportSelectedReport}
                >
                  Export JSON
                </Button>
              ) : null
            }
          >
            {!report ? (
              <Empty description="Pick a run to see its details" />
            ) : (
              <Space direction="vertical" style={{ width: "100%" }} size={16}>
                <Space size="large" wrap>
                  <Tag color={executionStatusColor(report.run.status as ExecutionStatus)}>
                    {report.run.status}
                  </Tag>
                  <Text type="secondary">Total: {report.run.total_tests}</Text>
                  <Text type="success">Passed: {report.run.passed_tests}</Text>
                  <Text type="danger">Failed: {report.run.failed_tests}</Text>
                  <Text>Skipped: {report.run.skipped_tests}</Text>
                  <Text type="secondary">
                    Duration: {formatDuration(finishedRunDurationMs(report.run))}
                  </Text>
                </Space>
                <Table<ExecutionResult>
                  rowKey="id"
                  dataSource={report.results}
                  columns={resultColumns}
                  size="small"
                  pagination={{ pageSize: 10 }}
                />
                {report.results.some((r) => r.error_message) && (
                  <List
                    bordered
                    header={<Text strong>Failures</Text>}
                    dataSource={report.results.filter((r) => r.error_message)}
                    renderItem={(r) => (
                      <List.Item>
                        <List.Item.Meta
                          title={
                            <Text strong>
                              {r.test_name ||
                                r.flow_name ||
                                r.test_case_id?.slice(0, 8) ||
                                "—"}
                            </Text>
                          }
                          description={
                            <Paragraph style={{ marginBottom: 0 }} type="secondary">
                              {r.error_message}
                            </Paragraph>
                          }
                        />
                      </List.Item>
                    )}
                  />
                )}
              </Space>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ReportsPage;
