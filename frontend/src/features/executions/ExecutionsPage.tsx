import { AlertOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Card, Space, Statistic, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import PageHeader from "@components/common/PageHeader";
import ProjectPicker from "@components/common/ProjectPicker";
import SelectProjectHint from "@components/common/SelectProjectHint";
import { ROUTES } from "@constants/routes";
import { useAppDispatch, useAppSelector } from "@app/store";
import { fetchRegressionsRequest } from "@features/reports/reportsSlice";
import { useSelectedProject } from "@hooks/useSelectedProject";
import { executionStatusColor, type ExecutionStatus } from "@utils/executionStatus";
import { fetchRunsRequest, selectRun } from "./executionsSlice";
import type { ExecutionRun } from "@services/executionApi";

const { Text } = Typography;

const POLL_MS = 5000;

export const ExecutionsPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { projectId, hasProject } = useSelectedProject();
  const { runs, loading } = useAppSelector((s) => s.executions);
  const regressions = useAppSelector((s) => s.reports.regressions);

  useEffect(() => {
    if (!projectId) return;
    dispatch(fetchRunsRequest(projectId));
    dispatch(fetchRegressionsRequest({ projectId, limit: 50 }));
  }, [projectId, dispatch]);

  useEffect(() => {
    if (!projectId) return;
    const id = setInterval(() => {
      dispatch(fetchRunsRequest(projectId));
      dispatch(fetchRegressionsRequest({ projectId, limit: 50 }));
    }, POLL_MS);
    return () => clearInterval(id);
  }, [projectId, dispatch]);

  const regressionCountByRun = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of regressions) {
      map.set(r.current_run_id, (map.get(r.current_run_id) ?? 0) + 1);
    }
    return map;
  }, [regressions]);

  const runningCount = useMemo(() => runs.filter((r) => r.status === "RUNNING").length, [runs]);
  const failedCount = useMemo(() => runs.filter((r) => r.status === "FAILED").length, [runs]);

  const columns: ColumnsType<ExecutionRun> = [
    {
      title: "Run",
      dataIndex: "id",
      render: (id: string) => {
        const reg = regressionCountByRun.get(id) ?? 0;
        return (
          <Space size={6}>
            <Text code style={{ fontSize: 12 }}>{id.slice(0, 8)}</Text>
            {reg > 0 && (
              <Tooltip title={`${reg} regression${reg > 1 ? "s" : ""} detected in this run`}>
                <Tag color="error" icon={<AlertOutlined />}>REGRESSION</Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      render: (s: string) => (
        <Tag color={executionStatusColor(s as ExecutionStatus)}>{s}</Tag>
      ),
    },
    {
      title: "Type",
      dataIndex: "run_type",
      width: 130,
      render: (t: string, r) => (
        <Space size={4}>
          <Tag>{t}</Tag>
          {r.schedule_id && <Tag color="purple">SCHED</Tag>}
        </Space>
      ),
    },
    { title: "Trigger", dataIndex: "triggered_by", width: 130 },
    {
      title: "Tests",
      key: "tests",
      width: 240,
      render: (_, r) => (
        <Space size="small">
          <Tag>Total {r.total_tests}</Tag>
          <Tag color="success">Pass {r.passed_tests}</Tag>
          <Tag color="error">Fail {r.failed_tests}</Tag>
          {r.skipped_tests > 0 && <Tag color="warning">Skip {r.skipped_tests}</Tag>}
        </Space>
      ),
    },
    {
      title: "Started",
      dataIndex: "started_at",
      render: (v: string) => (v ? new Date(v).toLocaleString() : "—"),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Executions"
        subtitle="Live and historical runs across all flows."
        actions={
          <Space>
            <ProjectPicker />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => projectId && dispatch(fetchRunsRequest(projectId))}
            >
              Refresh
            </Button>
          </Space>
        }
      />

      {!hasProject && <SelectProjectHint message="Select a project to view executions." />}

      {hasProject && (
        <Card style={{ marginBottom: 16 }}>
          <Space size={48} wrap>
            <Statistic title="Total runs" value={runs.length} />
            <Statistic
              title="Running now"
              value={runningCount}
              valueStyle={{ color: runningCount > 0 ? "#06b6d4" : undefined }}
            />
            <Statistic
              title="Failed"
              value={failedCount}
              valueStyle={{ color: failedCount > 0 ? "#ef4444" : undefined }}
            />
            <Statistic
              title="Regressions in latest run"
              value={regressions.length}
              prefix={regressions.length > 0 ? <AlertOutlined style={{ color: "#ef4444" }} /> : null}
              valueStyle={{ color: regressions.length > 0 ? "#ef4444" : undefined }}
            />
          </Space>
        </Card>
      )}

      <Card>
        <Table<ExecutionRun>
          rowKey="id"
          dataSource={runs}
          columns={columns}
          size="middle"
          loading={loading && runs.length === 0}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          onRow={(row) => ({
            onClick: () => {
              dispatch(selectRun(row.id));
              navigate(ROUTES.REPORTS);
            },
            style: {
              cursor: "pointer",
              background: regressionCountByRun.has(row.id)
                ? "rgba(239,68,68,0.05)"
                : undefined,
            },
          })}
          locale={{ emptyText: hasProject ? "No runs yet." : "" }}
        />
      </Card>
    </div>
  );
};

export default ExecutionsPage;
