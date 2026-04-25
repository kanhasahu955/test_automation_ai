import {
  AlertOutlined,
  ArrowRightOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  ExperimentOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Badge,
  Button,
  Col,
  Empty,
  List,
  Progress,
  Row,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import {
  ChartFrame,
  DonutChart,
  TrendBarChart,
  type DonutSlice,
  type TrendPoint,
} from "@components/charts";
import PageHeader from "@components/common/PageHeader";
import ProjectPicker from "@components/common/ProjectPicker";
import SelectProjectHint from "@components/common/SelectProjectHint";
import StatCard from "@components/common/StatCard";
import MotionCard from "@components/motion/MotionCard";
import { useAppDispatch, useAppSelector } from "@app/store";
import { ROUTES } from "@constants/routes";
import { selectRun } from "@features/executions/executionsSlice";
import { useSelectedProject } from "@hooks/useSelectedProject";
import type { ActivityItem, RegressionItem, TopFailingTest } from "@services/reportsApi";
import { tokens } from "@theme/tokens";
import { executionStatusColor, type ExecutionStatus } from "@utils/executionStatus";
import {
  fetchDashboardRequest,
  fetchRegressionsRequest,
} from "@features/reports/reportsSlice";

const { Text, Title } = Typography;

const DASHBOARD_REFRESH_MS = 15_000;
const DONUT_COLORS = [tokens.color.success, tokens.color.danger, tokens.color.warning];

const fmtTime = (iso?: string | null): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const relTime = (iso?: string | null): string => {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Math.max(0, Date.now() - t);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

export const DashboardPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { project, projectId } = useSelectedProject();
  const {
    kpis,
    qualityScore: score,
    trend,
    overview,
    regressions,
    loading,
  } = useAppSelector((s) => s.reports);

  useEffect(() => {
    if (!projectId) return;
    dispatch(fetchDashboardRequest({ projectId, days: 14 }));
    dispatch(fetchRegressionsRequest({ projectId, limit: 25 }));
  }, [projectId, dispatch]);

  useEffect(() => {
    if (!projectId) return;
    const id = window.setInterval(() => {
      dispatch(fetchDashboardRequest({ projectId, days: 14 }));
      dispatch(fetchRegressionsRequest({ projectId, limit: 25 }));
    }, DASHBOARD_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [projectId, dispatch]);

  const passRate = kpis?.pass_rate ?? 0;
  const failRate = kpis?.fail_rate ?? 0;
  const skipRate = Math.max(0, 100 - passRate - failRate);

  const exec = overview?.executions;
  const sched = overview?.schedules;
  const tcCounts = overview?.test_cases;
  const recentActivity: ActivityItem[] = overview?.recent_activity ?? [];
  const topFailing: TopFailingTest[] = overview?.top_failing_tests ?? [];

  const refresh = () => {
    if (!projectId) return;
    dispatch(fetchDashboardRequest({ projectId, days: 14 }));
    dispatch(fetchRegressionsRequest({ projectId, limit: 25 }));
  };

  const trendData: TrendPoint[] = useMemo(
    () =>
      trend.map((p) => ({
        ...p,
        label: p.date?.slice(5, 10) ?? "",
      })),
    [trend],
  );

  const distribution: DonutSlice[] = useMemo(() => {
    const slices = !exec
      ? [
          { name: "Passed", value: passRate },
          { name: "Failed", value: failRate },
          { name: "Skipped", value: skipRate },
        ]
      : [
          { name: "Passed", value: exec.today_passed },
          { name: "Failed", value: exec.today_failed },
          {
            name: "Other",
            value: Math.max(0, exec.today_total - exec.today_passed - exec.today_failed),
          },
        ];
    return slices.map((s, i) => ({ ...s, color: DONUT_COLORS[i] }));
  }, [exec, passRate, failRate, skipRate]);

  const handleOpenRun = (runId: string) => {
    dispatch(selectRun(runId));
    navigate(ROUTES.REPORTS);
  };

  return (
    <div>
      <PageHeader
        title="Quality Dashboard"
        subtitle="Live testing health, regressions, executions and schedules — all in one place."
        actions={
          <Space>
            <ProjectPicker />
            <Tooltip title="Refresh now">
              <Button icon={<ReloadOutlined />} onClick={refresh} disabled={!projectId} />
            </Tooltip>
          </Space>
        }
      />

      {!project && (
        <SelectProjectHint message="Select or create a project to see dashboard data." />
      )}

      <Row gutter={[16, 16]}>
        {/* ---------- Hero KPIs ---------- */}
        <Col xs={24} sm={12} md={8} lg={6} xl={4}>
          <StatCard
            title="Test Cases"
            value={tcCounts?.total ?? kpis?.total_test_cases ?? 0}
            hint={
              tcCounts
                ? `${tcCounts.automated} automated · ${tcCounts.manual} manual`
                : `${kpis?.automated_test_cases ?? 0} automated · ${kpis?.manual_test_cases ?? 0} manual`
            }
            icon={<ExperimentOutlined />}
            accent={tokens.color.primary}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={6} xl={4}>
          <StatCard
            title="Total Executions"
            value={exec?.total ?? 0}
            hint={`${exec?.today_total ?? 0} in last 24h`}
            icon={<PlayCircleOutlined />}
            accent={tokens.color.violet}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={6} xl={4}>
          <StatCard
            title="Running Now"
            value={
              <Space size={4}>
                <span>{exec?.running ?? 0}</span>
                {(exec?.running ?? 0) > 0 && <Badge status="processing" />}
              </Space>
            }
            hint={`${exec?.pending ?? 0} pending in queue`}
            icon={<ClockCircleOutlined />}
            accent={tokens.color.accent}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={6} xl={4}>
          <StatCard
            title="24h Pass Rate"
            value={`${exec?.last_24h_pass_rate ?? passRate}%`}
            hint={`${exec?.today_passed ?? 0} passed · ${exec?.today_failed ?? 0} failed`}
            icon={<CheckCircleOutlined />}
            accent={tokens.color.success}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={6} xl={4}>
          <StatCard
            title="Regressions"
            value={overview?.regressions_count ?? 0}
            hint={
              (overview?.regressions_count ?? 0) > 0
                ? "Tests broken in latest run"
                : "No regressions detected"
            }
            icon={<AlertOutlined />}
            accent={
              (overview?.regressions_count ?? 0) > 0
                ? tokens.color.danger
                : tokens.color.success
            }
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={6} xl={4}>
          <StatCard
            title="Active Schedules"
            value={sched?.active ?? 0}
            hint={
              sched?.next_fire_at
                ? `Next: ${relTime(sched.next_fire_at)}`
                : `${sched?.paused ?? 0} paused · ${sched?.total ?? 0} total`
            }
            icon={<CalendarOutlined />}
            accent={tokens.color.pink}
          />
        </Col>

        {/* ---------- Trend chart ---------- */}
        <Col xs={24} lg={16}>
          <ChartFrame
            index={0}
            title="Executions trend (14 days)"
            extra={<Tag color="processing">{trend.length} days</Tag>}
            loading={loading && !overview}
            empty={trendData.length === 0}
            emptyDescription="No executions in the selected window."
          >
            <TrendBarChart data={trendData} />
          </ChartFrame>
        </Col>

        {/* ---------- Result distribution ---------- */}
        <Col xs={24} lg={8}>
          <ChartFrame
            index={1}
            title="Last 24h distribution"
            height={220}
            loading={loading && !overview}
            empty={distribution.every((s) => !s.value)}
            emptyDescription="No runs in the last 24 hours."
          >
            <DonutChart data={distribution} />
          </ChartFrame>
        </Col>

        {/* ---------- Regressions ---------- */}
        <Col xs={24} lg={12}>
          <MotionCard
            index={2}
            title={
              <Space>
                <AlertOutlined style={{ color: tokens.color.danger }} />
                <span>Regressions</span>
                <Badge
                  count={regressions.length}
                  style={{ backgroundColor: tokens.color.danger }}
                  showZero
                />
              </Space>
            }
            extra={
              regressions.length > 0 && (
                <Button
                  type="link"
                  onClick={() => regressions[0] && handleOpenRun(regressions[0].current_run_id)}
                  icon={<ArrowRightOutlined />}
                >
                  Open run
                </Button>
              )
            }
            loading={loading && regressions.length === 0}
            style={{ height: "100%" }}
          >
            {regressions.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No regressions — every previously passing test still passes."
              />
            ) : (
              <List<RegressionItem>
                size="small"
                dataSource={regressions.slice(0, 6)}
                renderItem={(r) => (
                  <List.Item
                    actions={[
                      <Button
                        key="open"
                        size="small"
                        type="text"
                        onClick={() => handleOpenRun(r.current_run_id)}
                        icon={<ArrowRightOutlined />}
                      >
                        View run
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<WarningOutlined style={{ color: tokens.color.danger, fontSize: 18 }} />}
                      title={
                        <Space size={6} wrap>
                          <Text strong>{r.title}</Text>
                          <Tag color="error">{r.current_status}</Tag>
                          <Tag color="success">was {r.previous_status}</Tag>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={0} style={{ width: "100%" }}>
                          {r.error_message && (
                            <Text type="secondary" ellipsis style={{ maxWidth: 520 }}>
                              {r.error_message}
                            </Text>
                          )}
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Broken {relTime(r.broken_at)}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </MotionCard>
        </Col>

        {/* ---------- Top failing tests ---------- */}
        <Col xs={24} lg={12}>
          <MotionCard
            index={3}
            title={
              <Space>
                <CloseCircleOutlined style={{ color: tokens.color.danger }} />
                <span>Top failing tests</span>
              </Space>
            }
            extra={<Tag>last {kpis ? "20" : "—"} runs</Tag>}
            loading={loading && !overview}
            style={{ height: "100%" }}
          >
            {topFailing.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No failing tests." />
            ) : (
              <List<TopFailingTest>
                size="small"
                dataSource={topFailing}
                renderItem={(t) => {
                  const max = Math.max(...topFailing.map((x) => x.failures), 1);
                  const pct = Math.round((t.failures / max) * 100);
                  return (
                    <List.Item>
                      <Space direction="vertical" size={2} style={{ width: "100%" }}>
                        <Space style={{ width: "100%", justifyContent: "space-between" }}>
                          <Text strong>{t.title}</Text>
                          <Tag color="error">{t.failures} failures</Tag>
                        </Space>
                        <Progress
                          percent={pct}
                          showInfo={false}
                          strokeColor={tokens.color.danger}
                          trailColor={tokens.color.bgSoft}
                          size="small"
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          last failed {relTime(t.last_failed_at)}
                        </Text>
                      </Space>
                    </List.Item>
                  );
                }}
              />
            )}
          </MotionCard>
        </Col>

        {/* ---------- Activity feed ---------- */}
        <Col xs={24} lg={14}>
          <MotionCard
            index={4}
            title={
              <Space>
                <ThunderboltOutlined style={{ color: tokens.color.warning }} />
                <span>Recent activity</span>
              </Space>
            }
            extra={
              <Button type="link" onClick={() => navigate(ROUTES.EXECUTIONS)} icon={<ArrowRightOutlined />}>
                See all
              </Button>
            }
            loading={loading && !overview}
            style={{ height: "100%" }}
          >
            {recentActivity.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No runs yet — kick off a suite or schedule." />
            ) : (
              <List<ActivityItem>
                size="small"
                dataSource={recentActivity}
                renderItem={(a) => (
                  <List.Item
                    style={{ cursor: "pointer" }}
                    onClick={() => handleOpenRun(a.run_id)}
                  >
                    <List.Item.Meta
                      avatar={
                        <Tag color={executionStatusColor(a.status as ExecutionStatus)}>
                          {a.status}
                        </Tag>
                      }
                      title={
                        <Space>
                          <Text code style={{ fontSize: 12 }}>
                            {a.run_id.slice(0, 8)}
                          </Text>
                          <Tag>{a.run_type}</Tag>
                          {a.schedule_id && <Tag color="purple">SCHEDULED</Tag>}
                        </Space>
                      }
                      description={
                        <Space size={6} wrap>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {a.total_tests} tests
                          </Text>
                          <Tag color="success">Pass {a.passed_tests}</Tag>
                          <Tag color="error">Fail {a.failed_tests}</Tag>
                          {a.skipped_tests > 0 && <Tag color="warning">Skip {a.skipped_tests}</Tag>}
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            · {relTime(a.created_at)}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </MotionCard>
        </Col>

        {/* ---------- Quality score ---------- */}
        <Col xs={24} lg={10}>
          <MotionCard index={5} title="Quality score" loading={loading && !score}>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              {[
                { label: "Test Pass Rate", value: score?.test_pass_rate ?? 0, color: tokens.color.success },
                { label: "Data Quality", value: score?.data_quality ?? 0, color: tokens.color.accent },
                { label: "Automation Coverage", value: score?.automation_coverage ?? 0, color: tokens.color.primary },
                { label: "Defect Leakage", value: score?.defect_leakage ?? 0, color: tokens.color.warning },
                { label: "Pipeline Stability", value: score?.pipeline_stability ?? 0, color: tokens.color.violet },
              ].map((row) => (
                <div key={row.label}>
                  <Space style={{ width: "100%", justifyContent: "space-between" }}>
                    <Text type="secondary">{row.label}</Text>
                    <Text strong>{row.value}%</Text>
                  </Space>
                  <Progress percent={row.value} strokeColor={row.color} showInfo={false} />
                </div>
              ))}
              <div
                style={{
                  marginTop: 4,
                  padding: 16,
                  borderRadius: tokens.radius.md,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: tokens.gradient.brandSoft,
                }}
              >
                <Space>
                  <RobotOutlined style={{ color: tokens.color.primary, fontSize: 20 }} />
                  <Text strong>Final Quality Score</Text>
                </Space>
                <Title level={2} style={{ margin: 0 }}>
                  {score?.final_score ?? 0}%
                </Title>
              </div>
            </Space>
          </MotionCard>
        </Col>

        {/* ---------- Footer cards ---------- */}
        <Col xs={24} md={12}>
          <MotionCard index={6} title="Latest Run">
            <Space size="large" wrap>
              <Tag
                color={executionStatusColor(
                  (kpis?.latest_run_status ?? "PENDING") as ExecutionStatus,
                )}
              >
                {kpis?.latest_run_status ?? "No runs yet"}
              </Tag>
              <Text type="secondary">{fmtTime(kpis?.latest_run_at)}</Text>
            </Space>
          </MotionCard>
        </Col>

        <Col xs={24} md={12}>
          <MotionCard index={7} title="STM, Drift & Quality rules">
            <Space size={32} wrap>
              <Space direction="vertical" size={0}>
                <Text type="secondary">STM failures</Text>
                <Title level={3} style={{ margin: 0 }}>
                  {kpis?.stm_validation_failures ?? 0}
                </Title>
              </Space>
              <Space direction="vertical" size={0}>
                <Text type="secondary">Schema drift</Text>
                <Title level={3} style={{ margin: 0 }}>
                  {kpis?.schema_drift_count ?? 0}
                </Title>
              </Space>
              <Space direction="vertical" size={0}>
                <Text type="secondary">Failed quality rules</Text>
                <Title level={3} style={{ margin: 0 }}>
                  <ExclamationCircleOutlined style={{ color: tokens.color.danger }} />{" "}
                  {kpis?.failed_quality_rules ?? 0}
                </Title>
              </Space>
              <Space direction="vertical" size={0}>
                <Text type="secondary">Data quality</Text>
                <Title level={3} style={{ margin: 0 }}>
                  <ThunderboltOutlined style={{ color: tokens.color.warning }} />{" "}
                  {kpis?.data_quality_score ?? 0}%
                </Title>
              </Space>
            </Space>
          </MotionCard>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
