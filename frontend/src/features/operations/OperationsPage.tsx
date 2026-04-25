import {
  ApiOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ClusterOutlined,
  CodeOutlined,
  CopyOutlined,
  DatabaseOutlined,
  ExclamationCircleFilled,
  LinkOutlined,
  MinusCircleFilled,
  ReloadOutlined,
  RocketOutlined,
  ScheduleOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Badge,
  Button,
  Col,
  Empty,
  List,
  Row,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import PageHeader from "@components/common/PageHeader";
import StatCard from "@components/common/StatCard";
import MotionCard from "@components/motion/MotionCard";
import { ROUTES } from "@constants/routes";
import useSocketEvent from "@hooks/useSocketEvent";
import useSocketRoom from "@hooks/useSocketRoom";
import { opsApi } from "@services/opsApi";
import type {
  CeleryQueueStat,
  CeleryWorker,
  ComponentHealth,
  HealthStatus,
  OperationsSnapshot,
} from "@services/opsApi";
import { tokens } from "@theme/tokens";

const { Text, Title, Paragraph } = Typography;

const STATUS_META: Record<
  HealthStatus,
  { color: string; tone: string; label: string; icon: ReactNode }
> = {
  ok: {
    color: tokens.color.success,
    tone: "success",
    label: "Online",
    icon: <CheckCircleFilled />,
  },
  degraded: {
    color: tokens.color.warning,
    tone: "warning",
    label: "Degraded",
    icon: <ExclamationCircleFilled />,
  },
  down: {
    color: tokens.color.danger,
    tone: "error",
    label: "Down",
    icon: <CloseCircleFilled />,
  },
  unknown: {
    color: tokens.color.textFaint,
    tone: "default",
    label: "Unknown",
    icon: <MinusCircleFilled />,
  },
};

const StatusBadge = ({ status }: { status: HealthStatus }) => {
  const m = STATUS_META[status] ?? STATUS_META.unknown;
  return (
    <Tag
      color={m.tone}
      icon={m.icon}
      style={{ borderRadius: 999, padding: "2px 12px", fontWeight: 600 }}
    >
      {m.label}
    </Tag>
  );
};

const PingDot = ({ status }: { status: HealthStatus }) => {
  const m = STATUS_META[status] ?? STATUS_META.unknown;
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: 999,
        background: m.color,
        boxShadow: status === "ok" ? `0 0 0 4px ${m.color}33` : undefined,
        marginRight: 6,
      }}
    />
  );
};

const fmtMs = (n?: number | null) => (n == null ? "—" : `${n.toFixed(1)} ms`);

const HelpHint = ({
  status,
  service,
}: {
  status: HealthStatus;
  service: "flower" | "redis" | "airflow" | "celery" | "db";
}) => {
  if (status === "ok") return null;
  const HINTS: Record<typeof service, string> = {
    flower:
      "Start it locally with:  make flower    (or via docker:  make ops-up)",
    redis:
      "Spin up Redis:  make up   (compose) — or run  redis-server  locally on :6379",
    airflow:
      "Optional. Start with:  make airflow-up  (UI on http://localhost:8088, admin/admin)",
    celery:
      "No workers detected. Start one with:  make worker   (or via docker:  make up)",
    db: "MySQL not reachable. Bring up the stack with  make up  or check DB_HOST in backend/.env",
  };
  return (
    <Alert
      type="info"
      showIcon
      banner
      style={{ marginTop: 8 }}
      message={<Text style={{ fontSize: 12 }}>{HINTS[service]}</Text>}
    />
  );
};

// ---------------------------------------------------------------------------

const ExternalLinkCard = ({
  health,
  description,
  service,
}: {
  health: ComponentHealth;
  description: string;
  service: "flower" | "redis" | "airflow";
}) => {
  const open = () => {
    if (!health.url) return;
    window.open(health.url, "_blank", "noopener,noreferrer");
  };
  return (
    <MotionCard hoverable bodyStyle={{ padding: 20 }}>
      <Space direction="vertical" size={6} style={{ width: "100%" }}>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Title level={5} style={{ margin: 0 }}>
            {health.name}
          </Title>
          <StatusBadge status={health.status} />
        </Space>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {description}
        </Text>
        <Space size={8} wrap>
          {health.url && (
            <Tooltip title={health.url}>
              <Tag icon={<LinkOutlined />} style={{ cursor: "pointer" }} onClick={open}>
                {health.url.replace(/^https?:\/\//, "")}
              </Tag>
            </Tooltip>
          )}
          {health.latency_ms != null && <Tag>latency {fmtMs(health.latency_ms)}</Tag>}
          {health.detail && <Tag color="default">{health.detail}</Tag>}
        </Space>
        <Space style={{ marginTop: 8 }}>
          <Button
            type="primary"
            disabled={!health.url || health.status === "down"}
            onClick={open}
            icon={<ArrowRightOutlined />}
          >
            Open UI
          </Button>
          {health.url && (
            <Button
              icon={<CopyOutlined />}
              onClick={() => {
                navigator.clipboard.writeText(health.url!);
                message.success("URL copied");
              }}
            >
              Copy URL
            </Button>
          )}
        </Space>
        <HelpHint status={health.status} service={service} />
      </Space>
    </MotionCard>
  );
};

// ---------------------------------------------------------------------------

const workerColumns: ColumnsType<CeleryWorker> = [
  {
    title: "Worker",
    dataIndex: "name",
    key: "name",
    render: (v: string) => <Text code>{v}</Text>,
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    width: 120,
    render: (v: string) => (
      <Tag color={v === "ok" ? "success" : "default"} style={{ textTransform: "uppercase" }}>
        {v}
      </Tag>
    ),
  },
  {
    title: "Active tasks",
    dataIndex: "active",
    key: "active",
    width: 120,
    align: "right",
    render: (v: number) => <Text strong>{v}</Text>,
  },
  {
    title: "Total processed",
    dataIndex: "processed",
    key: "processed",
    width: 160,
    align: "right",
    render: (v: number) => v.toLocaleString(),
  },
  {
    title: "Queues",
    dataIndex: "queues",
    key: "queues",
    render: (queues: string[]) => (
      <Space size={4} wrap>
        {queues.length === 0 ? (
          <Text type="secondary">—</Text>
        ) : (
          queues.map((q) => (
            <Tag key={q} color="geekblue">
              {q}
            </Tag>
          ))
        )}
      </Space>
    ),
  },
];

const queueColumns: ColumnsType<CeleryQueueStat> = [
  {
    title: "Queue",
    dataIndex: "name",
    key: "name",
    render: (v: string) => <Tag color="geekblue">{v}</Tag>,
  },
  {
    title: "Workers consuming",
    dataIndex: "workers",
    key: "workers",
    render: (workers: string[]) =>
      workers.length === 0 ? (
        <Text type="secondary">no consumers</Text>
      ) : (
        <Space size={4} wrap>
          {workers.map((w) => (
            <Tag key={w}>{w}</Tag>
          ))}
        </Space>
      ),
  },
];

// ---------------------------------------------------------------------------

const OperationsPage = () => {
  const [snap, setSnap] = useState<OperationsSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Manual refresh (toolbar button) still uses the REST endpoint so the user
  // can force an immediate read independent of the Socket.IO cadence.
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await opsApi.snapshot();
      setSnap(s);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load operations snapshot.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial paint via REST so the page is populated even if Socket.IO is
  // still mid-handshake. We intentionally run this only once on mount; the
  // ``refresh`` closure is stable enough.
  const didInitialLoadRef = useRef(false);
  useEffect(() => {
    if (didInitialLoadRef.current) return;
    didInitialLoadRef.current = true;
    void refresh();
  }, [refresh]);

  // Push-based updates over Socket.IO: joining the ``ops`` room triggers an
  // immediate snapshot and enrolls us in the 10s broadcast tick. The server
  // gates the snapshot loop on subscriber count so it does no work when
  // nobody is watching.
  useSocketRoom({ type: "ops" });
  useSocketEvent<OperationsSnapshot>("ops.snapshot", (data) => {
    setSnap(data);
    setLastUpdated(new Date());
    setError(null);
  });
  useSocketEvent<{ message?: string }>("ops.error", (data) => {
    setError(data?.message ?? "Operations probe failed.");
  });

  const totals = useMemo(() => {
    if (!snap) return { workers: 0, active: 0, processed: 0, queues: 0, redbeat: 0 };
    return {
      workers: snap.celery.workers.length,
      active: snap.celery.workers.reduce((acc, w) => acc + w.active, 0),
      processed: snap.celery.workers.reduce((acc, w) => acc + w.processed, 0),
      queues: snap.celery.queues.length,
      redbeat: snap.redis.redbeat_keys ?? 0,
    };
  }, [snap]);

  const overallStatus: HealthStatus = useMemo(() => {
    if (!snap) return "unknown";
    const all = [
      snap.api.status,
      snap.database.status,
      snap.redis.status,
      snap.celery.status,
    ];
    if (all.some((s) => s === "down")) return "down";
    if (all.some((s) => s === "degraded" || s === "unknown")) return "degraded";
    return "ok";
  }, [snap]);

  return (
    <div>
      <PageHeader
        title="Operations Console"
        subtitle="Live health for MySQL, Redis, Celery, Flower and Airflow — push updates over Socket.IO."
        actions={
          <Space>
            {lastUpdated && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Updated {lastUpdated.toLocaleTimeString()}
              </Text>
            )}
            <Button icon={<ReloadOutlined />} onClick={() => void refresh()} loading={loading}>
              Refresh
            </Button>
          </Space>
        }
      />

      {error && (
        <Alert
          type="error"
          showIcon
          closable
          message="Could not reach the API"
          description={error}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Top KPI strip */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8} lg={6}>
          <MotionCard index={0} bodyStyle={{ padding: 20 }}>
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Text type="secondary" style={{ fontSize: 11, letterSpacing: 0.5 }}>
                OVERALL STATUS
              </Text>
              <Badge
                status={
                  overallStatus === "ok"
                    ? "success"
                    : overallStatus === "down"
                      ? "error"
                      : "warning"
                }
              />
            </Space>
            <Space align="center" size={10} style={{ marginTop: 6 }}>
              <PingDot status={overallStatus} />
              <Title level={2} style={{ margin: 0 }}>
                {STATUS_META[overallStatus].label}
              </Title>
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {snap?.api.detail ?? "Polling…"}
            </Text>
          </MotionCard>
        </Col>
        <Col xs={24} md={8} lg={6}>
          <StatCard
            title="Celery workers"
            value={totals.workers}
            hint={`${totals.active} active task(s) right now`}
            icon={<ClusterOutlined />}
            accent={tokens.color.primary}
          />
        </Col>
        <Col xs={24} md={8} lg={6}>
          <StatCard
            title="Tasks processed"
            value={totals.processed.toLocaleString()}
            hint="All workers, since last restart"
            icon={<ThunderboltOutlined />}
            accent={tokens.color.accent}
          />
        </Col>
        <Col xs={24} md={8} lg={6}>
          <StatCard
            title="Schedules in RedBeat"
            value={totals.redbeat}
            hint="Active recurring jobs in Redis"
            icon={<ScheduleOutlined />}
            accent={tokens.color.violet}
          />
        </Col>
      </Row>

      {/* Health cards row */}
      <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
        <Col xs={24} md={12} lg={8}>
          <MotionCard index={1} bodyStyle={{ padding: 20 }}>
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Space>
                <ApiOutlined style={{ color: tokens.color.primary }} />
                <Title level={5} style={{ margin: 0 }}>
                  API Service
                </Title>
              </Space>
              <StatusBadge status={snap?.api.status ?? "unknown"} />
            </Space>
            <Paragraph type="secondary" style={{ marginBottom: 4, marginTop: 8 }}>
              FastAPI server reachable at{" "}
              <Text code>{snap?.api.detail ?? "/api/v1/health"}</Text>.
            </Paragraph>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Static docs: <a href="/api/docs" target="_blank" rel="noreferrer">Swagger UI</a> •{" "}
              <a href="/api/redoc" target="_blank" rel="noreferrer">ReDoc</a>
            </Text>
          </MotionCard>
        </Col>

        <Col xs={24} md={12} lg={8}>
          <MotionCard index={2} bodyStyle={{ padding: 20 }}>
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Space>
                <DatabaseOutlined style={{ color: tokens.color.accent }} />
                <Title level={5} style={{ margin: 0 }}>
                  MySQL
                </Title>
              </Space>
              <StatusBadge status={snap?.database.status ?? "unknown"} />
            </Space>
            <Paragraph type="secondary" style={{ marginBottom: 4, marginTop: 8 }}>
              {snap?.database.detail ?? "Polling…"}
            </Paragraph>
            <Space wrap size={6}>
              {snap?.database.latency_ms != null && (
                <Tag color="cyan">latency {fmtMs(snap.database.latency_ms)}</Tag>
              )}
            </Space>
            <HelpHint status={snap?.database.status ?? "unknown"} service="db" />
          </MotionCard>
        </Col>

        <Col xs={24} md={12} lg={8}>
          <MotionCard index={3} bodyStyle={{ padding: 20 }}>
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Space>
                <RocketOutlined style={{ color: tokens.color.pink }} />
                <Title level={5} style={{ margin: 0 }}>
                  Redis
                </Title>
              </Space>
              <StatusBadge status={snap?.redis.status ?? "unknown"} />
            </Space>
            <Paragraph type="secondary" style={{ marginBottom: 4, marginTop: 8 }}>
              {snap?.redis.detail ?? "Polling…"}
            </Paragraph>
            <Space wrap size={6}>
              {snap?.redis.latency_ms != null && (
                <Tag color="cyan">latency {fmtMs(snap.redis.latency_ms)}</Tag>
              )}
              {snap?.redis.used_memory_human && (
                <Tag>memory {snap.redis.used_memory_human}</Tag>
              )}
              {snap?.redis.connected_clients != null && (
                <Tag>{snap.redis.connected_clients} clients</Tag>
              )}
              {snap?.redis.redbeat_keys != null && (
                <Tag color="purple">{snap.redis.redbeat_keys} redbeat keys</Tag>
              )}
            </Space>
            {snap?.redis.db_keys && Object.keys(snap.redis.db_keys).length > 0 && (
              <Space wrap size={4} style={{ marginTop: 6 }}>
                {Object.entries(snap.redis.db_keys).map(([k, v]) => (
                  <Tag key={k} color="blue">
                    {k}: {v}
                  </Tag>
                ))}
              </Space>
            )}
            <HelpHint status={snap?.redis.status ?? "unknown"} service="redis" />
          </MotionCard>
        </Col>
      </Row>

      {/* External UIs */}
      <div style={{ marginTop: 24 }}>
        <Title level={4} style={{ marginBottom: 8 }}>
          External dashboards
        </Title>
        <Text type="secondary">
          The app pings each URL from the API container and shows a live status badge. Click{" "}
          <Text strong>Open UI</Text> to launch the full dashboard in a new tab.
        </Text>
      </div>
      <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
        <Col xs={24} md={12} lg={8}>
          <ExternalLinkCard
            health={snap?.links.flower ?? { name: "Flower", status: "unknown" }}
            description="Real-time Celery monitor — workers, queues, task history, retry counts."
            service="flower"
          />
        </Col>
        <Col xs={24} md={12} lg={8}>
          <ExternalLinkCard
            health={
              snap?.links.redis_commander ?? { name: "Redis Commander", status: "unknown" }
            }
            description="Browse Redis keys (broker, results, RedBeat schedules) with a friendly UI."
            service="redis"
          />
        </Col>
        <Col xs={24} md={12} lg={8}>
          <ExternalLinkCard
            health={snap?.links.airflow ?? { name: "Airflow", status: "unknown" }}
            description="Optional: run the QualityForge regression / data-quality DAGs."
            service="airflow"
          />
        </Col>
      </Row>

      {/* Celery deep-dive */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={14}>
          <MotionCard
            index={4}
            title={
              <Space>
                <ClusterOutlined />
                <span>Celery workers</span>
              </Space>
            }
            extra={<StatusBadge status={snap?.celery.status ?? "unknown"} />}
            bodyStyle={{ padding: 0 }}
          >
            {snap?.celery.workers.length ? (
              <Table
                rowKey="name"
                size="small"
                pagination={false}
                dataSource={snap.celery.workers}
                columns={workerColumns}
                scroll={{ x: "max-content" }}
              />
            ) : (
              <div style={{ padding: 24 }}>
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span>
                      {snap?.celery.detail ?? "No workers detected."} Start one with{" "}
                      <Text code>make worker</Text>.
                    </span>
                  }
                />
                <HelpHint status="down" service="celery" />
              </div>
            )}
          </MotionCard>
        </Col>

        <Col xs={24} lg={10}>
          <MotionCard
            index={5}
            title={
              <Space>
                <ScheduleOutlined />
                <span>Queues</span>
              </Space>
            }
            bodyStyle={{ padding: 0 }}
          >
            <Table
              rowKey="name"
              size="small"
              pagination={false}
              dataSource={snap?.celery.queues ?? []}
              columns={queueColumns}
              scroll={{ x: "max-content" }}
              locale={{
                emptyText: snap ? "No active queues." : "Loading…",
              }}
            />
          </MotionCard>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <MotionCard
            index={6}
            title={
              <Space>
                <CodeOutlined />
                <span>Registered tasks</span>
                <Tag color="default">{snap?.celery.registered_tasks.length ?? 0}</Tag>
              </Space>
            }
            extra={
              <Tooltip title="Where to find them">
                <a href={ROUTES.DOCS_PAGE("operations")}>Docs</a>
              </Tooltip>
            }
          >
            {snap?.celery.registered_tasks.length ? (
              <List
                size="small"
                grid={{ gutter: 12, xs: 1, sm: 2, md: 3, lg: 4, xl: 5 }}
                dataSource={snap.celery.registered_tasks}
                renderItem={(task) => (
                  <List.Item>
                    <Tag color="processing" style={{ width: "100%", textAlign: "center" }}>
                      {task}
                    </Tag>
                  </List.Item>
                )}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Workers haven't reported their task list yet."
              />
            )}
          </MotionCard>
        </Col>
      </Row>
    </div>
  );
};

export default OperationsPage;
