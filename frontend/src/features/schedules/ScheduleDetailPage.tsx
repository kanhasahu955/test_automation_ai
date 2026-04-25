import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SyncOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Row,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";

import PageHeader from "@components/common/PageHeader";
import { useAppDispatch, useAppSelector } from "@app/store";
import { ROUTES } from "@constants/routes";
import type { ExecutionRun } from "@services/executionApi";
import { cronToHuman, nextRuns } from "@utils/cron";

import ScheduleFormDrawer from "./ScheduleFormDrawer";
import {
  fetchHistoryRequest,
  fetchOneRequest,
  pauseRequest,
  resumeRequest,
  runNowRequest,
} from "./schedulesSlice";

dayjs.extend(relativeTime);

const { Text } = Typography;

const RUN_STATUS_COLOR: Record<string, string> = {
  PENDING: "default",
  RUNNING: "processing",
  PASSED: "success",
  FAILED: "error",
  CANCELLED: "warning",
};

const RUN_STATUS_ICON: Record<string, ReactNode> = {
  PENDING: <ClockCircleOutlined />,
  RUNNING: <SyncOutlined spin />,
  PASSED: <CheckCircleOutlined />,
  FAILED: <CloseCircleOutlined />,
  CANCELLED: <PauseCircleOutlined />,
};

export const ScheduleDetailPage = () => {
  const { scheduleId = "" } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { message } = App.useApp();

  const schedule = useAppSelector((s) => s.schedules.current);
  const loading = useAppSelector((s) => s.schedules.loading);
  const history = useAppSelector((s) => s.schedules.history);
  const historyLoading = useAppSelector((s) => s.schedules.historyLoading);
  const error = useAppSelector((s) => s.schedules.error);

  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!scheduleId) return;
    dispatch(fetchOneRequest(scheduleId));
    dispatch(fetchHistoryRequest(scheduleId));
  }, [scheduleId, dispatch]);

  useEffect(() => {
    if (error) message.error(error);
  }, [error, message]);

  const upcoming = useMemo(() => {
    if (!schedule) return [] as string[];
    return nextRuns(schedule.cron_expression, schedule.timezone, 5);
  }, [schedule]);

  if (loading || !schedule) {
    return (
      <div>
        <PageHeader
          title="Schedule"
          actions={
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(ROUTES.SCHEDULES)}>
              Back
            </Button>
          }
        />
        <Card>
          <Skeleton active />
        </Card>
      </div>
    );
  }

  const onToggle = () => {
    if (schedule.status === "ACTIVE") {
      dispatch(pauseRequest(schedule.id));
    } else {
      dispatch(resumeRequest(schedule.id));
    }
  };

  const onRunNow = () => {
    dispatch(runNowRequest(schedule.id));
    message.success("Triggered. Watch the History tab.");
    setTimeout(() => dispatch(fetchHistoryRequest(schedule.id)), 1500);
  };

  const refreshHistory = () => dispatch(fetchHistoryRequest(schedule.id));

  const columns: ColumnsType<ExecutionRun> = [
    {
      title: "Status",
      dataIndex: "status",
      width: 130,
      render: (s: string) => (
        <Tag color={RUN_STATUS_COLOR[s] ?? "default"} icon={RUN_STATUS_ICON[s]}>
          {s}
        </Tag>
      ),
    },
    {
      title: "Started",
      dataIndex: "started_at",
      width: 200,
      render: (v: string | undefined, row) => (
        <Space direction="vertical" size={0}>
          <Text>{v ? dayjs(v).format("MMM D HH:mm:ss") : "—"}</Text>
          {row.created_at && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              created {dayjs(row.created_at).fromNow()}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Duration",
      width: 110,
      render: (_, row) => {
        if (!row.started_at || !row.finished_at) return "—";
        const ms = dayjs(row.finished_at).diff(dayjs(row.started_at));
        return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
      },
    },
    {
      title: "Tests",
      dataIndex: "total_tests",
      width: 130,
      render: (_, row) => (
        <Space size={4}>
          <Tag color="green">{row.passed_tests}</Tag>
          <Tag color="red">{row.failed_tests}</Tag>
          <Tag color="gold">{row.skipped_tests}</Tag>
          <Text type="secondary" style={{ fontSize: 11 }}>
            of {row.total_tests}
          </Text>
        </Space>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 100,
      render: (_, row) => (
        <Button size="small" onClick={() => navigate(`${ROUTES.REPORTS}?run=${row.id}`)}>
          View report
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={schedule.name}
        subtitle={schedule.description ?? "Recurring execution schedule."}
        actions={
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(ROUTES.SCHEDULES)}>
              Back
            </Button>
            <Button
              icon={schedule.status === "ACTIVE" ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={onToggle}
            >
              {schedule.status === "ACTIVE" ? "Pause" : "Resume"}
            </Button>
            <Button icon={<EditOutlined />} onClick={() => setDrawerOpen(true)}>
              Edit
            </Button>
            <Button type="primary" icon={<ThunderboltOutlined />} onClick={onRunNow}>
              Run now
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={16}>
          <Card title="Cadence" size="small">
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="Status" span={2}>
                <Tag
                  color={schedule.status === "ACTIVE" ? "green" : "default"}
                  icon={
                    schedule.status === "ACTIVE" ? (
                      <PlayCircleOutlined />
                    ) : (
                      <PauseCircleOutlined />
                    )
                  }
                >
                  {schedule.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Cadence" span={2}>
                <Space direction="vertical" size={0}>
                  <Text strong>{cronToHuman(schedule.cron_expression)}</Text>
                  <Text style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                    {schedule.cron_expression}
                  </Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Timezone">{schedule.timezone}</Descriptions.Item>
              <Descriptions.Item label="Target type">{schedule.target_type}</Descriptions.Item>
              <Descriptions.Item label="Target id" span={2}>
                <Text code copyable>
                  {schedule.target_id}
                </Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="Reliability" size="small">
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="Total" value={schedule.total_runs} />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Passed"
                  value={schedule.success_runs}
                  valueStyle={{ color: "#10b981" }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Failed"
                  value={schedule.failure_runs}
                  valueStyle={{ color: "#ef4444" }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col span={24}>
          <Card title="Upcoming runs" size="small">
            {upcoming.length === 0 ? (
              <Empty description="No upcoming runs (schedule is paused or cron is invalid)." />
            ) : (
              <Space direction="vertical" size={4}>
                {upcoming.map((iso) => (
                  <Text key={iso}>
                    <ClockCircleOutlined style={{ marginRight: 8, opacity: 0.6 }} />
                    {dayjs(iso).format("ddd, MMM D YYYY · HH:mm")}{" "}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      ({schedule.timezone}) — {dayjs(iso).fromNow()}
                    </Text>
                  </Text>
                ))}
              </Space>
            )}
          </Card>
        </Col>

        <Col span={24}>
          <Card
            title="Run history"
            size="small"
            extra={
              <Button size="small" icon={<ReloadOutlined />} onClick={refreshHistory}>
                Refresh
              </Button>
            }
          >
            <Table<ExecutionRun>
              rowKey="id"
              loading={historyLoading}
              dataSource={history}
              columns={columns}
              scroll={{ x: "max-content" }}
              pagination={{ pageSize: 20 }}
              locale={{ emptyText: "No runs yet — try the Run now button." }}
            />
          </Card>
        </Col>
      </Row>

      <ScheduleFormDrawer
        open={drawerOpen}
        initial={schedule}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
};

export default ScheduleDetailPage;
