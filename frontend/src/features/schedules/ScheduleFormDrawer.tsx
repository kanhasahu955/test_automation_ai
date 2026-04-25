import { Button, Drawer, Form, Input, Select, Space } from "antd";
import { useEffect, useMemo, useState } from "react";

import CronBuilder from "@components/schedule/CronBuilder";
import { useAppDispatch, useAppSelector } from "@app/store";
import type {
  Schedule,
  ScheduleCreateInput,
  ScheduleTargetType,
} from "@services/scheduleApi";
import { defaultCadence, type Cadence } from "@utils/cron";

import { createRequest, updateRequest } from "./schedulesSlice";
import { useTargetOptions } from "./useTargetOptions";

const TARGET_TYPE_OPTIONS: { value: ScheduleTargetType; label: string }[] = [
  { value: "TEST_SUITE", label: "Test Suite" },
  { value: "NO_CODE_FLOW", label: "No-Code Flow" },
  { value: "STM_DOCUMENT", label: "STM Document" },
];

export type ScheduleFormDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** When provided the drawer enters *edit* mode. */
  initial?: Schedule | null;
};

type FormShape = {
  name: string;
  description?: string;
  target_type: ScheduleTargetType;
  target_id: string;
};

const cadenceFromSchedule = (s: Schedule): Cadence => {
  const cfg = (s.cadence_config ?? {}) as Record<string, unknown>;
  switch (s.cadence_kind) {
    case "HOURLY":
      return { kind: "HOURLY", minute: Number(cfg.minute ?? 0) };
    case "DAILY":
      return {
        kind: "DAILY",
        hour: Number(cfg.hour ?? 2),
        minute: Number(cfg.minute ?? 0),
      };
    case "WEEKLY":
      return {
        kind: "WEEKLY",
        hour: Number(cfg.hour ?? 2),
        minute: Number(cfg.minute ?? 0),
        days_of_week: Array.isArray(cfg.days_of_week)
          ? (cfg.days_of_week as number[])
          : [1],
      };
    case "MONTHLY":
      return {
        kind: "MONTHLY",
        day_of_month: Number(cfg.day_of_month ?? 1),
        hour: Number(cfg.hour ?? 2),
        minute: Number(cfg.minute ?? 0),
      };
    case "CUSTOM":
    default:
      return {
        kind: "CUSTOM",
        expression:
          typeof cfg.expression === "string" ? cfg.expression : s.cron_expression,
      };
  }
};

export const ScheduleFormDrawer = ({
  open,
  onClose,
  initial,
}: ScheduleFormDrawerProps) => {
  const dispatch = useAppDispatch();
  const project = useAppSelector((s) => s.projects.selected);
  const saving = useAppSelector((s) => s.schedules.saving);

  const [form] = Form.useForm<FormShape>();
  const [cadence, setCadence] = useState<Cadence>(defaultCadence());
  const [tz, setTz] = useState<string>("UTC");
  const [targetType, setTargetType] = useState<ScheduleTargetType>("TEST_SUITE");

  const { options: targetOptions, loading: targetsLoading } = useTargetOptions(
    project?.id,
    targetType,
  );

  // Hydrate when opening in edit mode, reset when opening in create mode.
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTargetType(initial.target_type);
      setCadence(cadenceFromSchedule(initial));
      setTz(initial.timezone || "UTC");
      form.setFieldsValue({
        name: initial.name,
        description: initial.description ?? undefined,
        target_type: initial.target_type,
        target_id: initial.target_id,
      });
    } else {
      setTargetType("TEST_SUITE");
      setCadence(defaultCadence());
      setTz("UTC");
      form.resetFields();
      form.setFieldsValue({ target_type: "TEST_SUITE" });
    }
  }, [open, initial, form]);

  const title = useMemo(
    () => (initial ? `Edit schedule — ${initial.name}` : "New schedule"),
    [initial],
  );

  const onSubmit = async () => {
    const values = await form.validateFields();
    if (initial) {
      dispatch(
        updateRequest({
          id: initial.id,
          data: {
            name: values.name,
            description: values.description ?? null,
            cadence,
            timezone: tz,
          },
        }),
      );
    } else {
      if (!project) return;
      const payload: ScheduleCreateInput = {
        name: values.name,
        description: values.description ?? null,
        target_type: values.target_type,
        target_id: values.target_id,
        cadence,
        timezone: tz,
        status: "ACTIVE",
      };
      dispatch(createRequest({ projectId: project.id, data: payload }));
    }
    onClose();
  };

  return (
    <Drawer
      title={title}
      width={620}
      open={open}
      onClose={onClose}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={saving} onClick={onSubmit}>
            {initial ? "Save changes" : "Create schedule"}
          </Button>
        </Space>
      }
    >
      <Form<FormShape>
        layout="vertical"
        form={form}
        initialValues={{ target_type: "TEST_SUITE" }}
      >
        <Form.Item
          label="Name"
          name="name"
          rules={[{ required: true, message: "Schedule name is required" }]}
        >
          <Input placeholder="Nightly STM smoke" maxLength={200} />
        </Form.Item>

        <Form.Item label="Description" name="description">
          <Input.TextArea
            rows={2}
            placeholder="What does this schedule do? (optional)"
          />
        </Form.Item>

        <Form.Item
          label="Run target type"
          name="target_type"
          rules={[{ required: true }]}
        >
          <Select
            disabled={!!initial}
            options={TARGET_TYPE_OPTIONS}
            onChange={(v) => {
              setTargetType(v as ScheduleTargetType);
              form.setFieldValue("target_id", undefined);
            }}
          />
        </Form.Item>

        <Form.Item
          label="Run target"
          name="target_id"
          rules={[{ required: true, message: "Pick what to run" }]}
        >
          <Select
            disabled={!!initial}
            loading={targetsLoading}
            options={targetOptions}
            placeholder={
              targetOptions.length === 0
                ? "No targets of this type yet — create one first"
                : "Select a target"
            }
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>

        <Form.Item label="Cadence">
          <CronBuilder
            value={cadence}
            timezone={tz}
            onChange={setCadence}
            onTimezoneChange={setTz}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default ScheduleFormDrawer;
