import {
  CalendarOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Empty,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import PageHeader from "@components/common/PageHeader";
import ProjectPicker from "@components/common/ProjectPicker";
import SelectProjectHint from "@components/common/SelectProjectHint";
import { useAppDispatch, useAppSelector } from "@app/store";
import { ROUTES } from "@constants/routes";
import type { Schedule, ScheduleTargetType } from "@services/scheduleApi";
import { cronToHuman } from "@utils/cron";

import ScheduleFormDrawer from "./ScheduleFormDrawer";
import {
  deleteRequest,
  fetchListRequest,
  pauseRequest,
  resumeRequest,
  runNowRequest,
} from "./schedulesSlice";

dayjs.extend(relativeTime);

const { Text } = Typography;

const TARGET_TAG_COLOR: Record<ScheduleTargetType, string> = {
  TEST_SUITE: "purple",
  NO_CODE_FLOW: "geekblue",
  STM_DOCUMENT: "magenta",
};

const TARGET_TAG_LABEL: Record<ScheduleTargetType, string> = {
  TEST_SUITE: "Suite",
  NO_CODE_FLOW: "Flow",
  STM_DOCUMENT: "STM",
};

const formatDate = (iso?: string | null, tz?: string) => {
  if (!iso) return "—";
  const d = dayjs(iso);
  return tz ? d.format("MMM D, HH:mm") + ` (${tz})` : d.format("MMM D, HH:mm");
};

export const SchedulesListPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const project = useAppSelector((s) => s.projects.selected);
  const { items, loading, error } = useAppSelector((s) => s.schedules);
  const { message } = App.useApp();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);

  useEffect(() => {
    if (project?.id) dispatch(fetchListRequest({ projectId: project.id }));
  }, [project?.id, dispatch]);

  useEffect(() => {
    if (error) message.error(error);
  }, [error, message]);

  const onCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const onEdit = (row: Schedule) => {
    setEditing(row);
    setDrawerOpen(true);
  };

  const onToggle = (row: Schedule, checked: boolean) => {
    dispatch(checked ? resumeRequest(row.id) : pauseRequest(row.id));
  };

  const onRunNow = (row: Schedule) => {
    dispatch(runNowRequest(row.id));
    message.success(`Triggered "${row.name}". Check the Executions page in a few seconds.`);
  };

  const onDelete = (row: Schedule) => {
    dispatch(deleteRequest(row.id));
  };

  const columns: ColumnsType<Schedule> = [
    {
      title: "Schedule",
      dataIndex: "name",
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <a onClick={() => navigate(ROUTES.SCHEDULE_DETAIL(row.id))}>
            <Text strong>{row.name}</Text>
          </a>
          {row.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Target",
      dataIndex: "target_type",
      width: 130,
      render: (_, row) => (
        <Tag color={TARGET_TAG_COLOR[row.target_type]}>
          {TARGET_TAG_LABEL[row.target_type]}
        </Tag>
      ),
    },
    {
      title: "Cadence",
      dataIndex: "cron_expression",
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 13 }}>{cronToHuman(row.cron_expression)}</Text>
          <Text type="secondary" style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }}>
            {row.cron_expression} · {row.timezone}
          </Text>
        </Space>
      ),
    },
    {
      title: "Next run",
      dataIndex: "next_run_at",
      width: 200,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 13 }}>
            <ClockCircleOutlined style={{ marginRight: 6, opacity: 0.6 }} />
            {formatDate(row.next_run_at)}
          </Text>
          {row.next_run_at && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {dayjs(row.next_run_at).fromNow()}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Last run",
      dataIndex: "last_run_at",
      width: 180,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 13 }}>{formatDate(row.last_run_at)}</Text>
          <Space size={4}>
            <Tag color="green">{row.success_runs}✓</Tag>
            <Tag color="red">{row.failure_runs}✗</Tag>
          </Space>
        </Space>
      ),
    },
    {
      title: "Active",
      dataIndex: "status",
      width: 90,
      render: (_, row) => (
        <Switch
          checked={row.status === "ACTIVE"}
          checkedChildren={<PlayCircleOutlined />}
          unCheckedChildren={<PauseCircleOutlined />}
          onChange={(checked) => onToggle(row, checked)}
        />
      ),
    },
    {
      title: "",
      key: "actions",
      width: 130,
      fixed: "right",
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="Run now">
            <Button
              size="small"
              type="text"
              icon={<ThunderboltOutlined />}
              onClick={() => onRunNow(row)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              onClick={() => onEdit(row)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this schedule?"
            description="This stops future runs immediately. Existing run history is preserved."
            onConfirm={() => onDelete(row)}
            okText="Delete"
            okType="danger"
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Schedules"
        subtitle="Run test suites, no-code flows and STM validations on a recurring cadence."
        actions={
          <Space wrap>
            <ProjectPicker />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={onCreate}
              disabled={!project}
            >
              New schedule
            </Button>
          </Space>
        }
      />

      {!project ? (
        <SelectProjectHint
          message="Select a project to manage its scheduled runs."
        />
      ) : (
        <Table<Schedule>
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={columns}
          pagination={{ pageSize: 20 }}
          locale={{
            emptyText: (
              <Empty
                description={
                  <Space direction="vertical" size={4}>
                    <Text strong>No schedules yet</Text>
                    <Text type="secondary">
                      Click <CalendarOutlined /> &ldquo;New schedule&rdquo; to add your first one.
                    </Text>
                  </Space>
                }
              />
            ),
          }}
          scroll={{ x: 1100 }}
        />
      )}

      <ScheduleFormDrawer
        open={drawerOpen}
        initial={editing}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
};

export default SchedulesListPage;
