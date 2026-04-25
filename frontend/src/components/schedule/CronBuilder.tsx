import {
  CalendarOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  FieldTimeOutlined,
  ScheduleOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Card,
  Col,
  Input,
  InputNumber,
  Row,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useEffect, useMemo, type ReactNode } from "react";

import {
  cadenceToCron,
  COMMON_TIMEZONES,
  cronToHuman,
  DOW_LABELS,
  nextRuns,
  validateCron,
  type Cadence,
  type CadenceKind,
} from "@utils/cron";

dayjs.extend(utc);
dayjs.extend(timezone);

const { Text, Title } = Typography;

export type CronBuilderProps = {
  value: Cadence;
  timezone: string;
  onChange: (cadence: Cadence) => void;
  onTimezoneChange: (tz: string) => void;
};

const KIND_LABELS: { label: string; value: CadenceKind; icon: ReactNode }[] = [
  { label: "Hourly", value: "HOURLY", icon: <ClockCircleOutlined /> },
  { label: "Daily", value: "DAILY", icon: <FieldTimeOutlined /> },
  { label: "Weekly", value: "WEEKLY", icon: <ScheduleOutlined /> },
  { label: "Monthly", value: "MONTHLY", icon: <CalendarOutlined /> },
  { label: "Custom", value: "CUSTOM", icon: <CodeOutlined /> },
];

/** Convert a cadence-of-one-kind to another, preserving sensible defaults. */
const morphCadence = (next: CadenceKind, prev: Cadence): Cadence => {
  const baseHour = "hour" in prev ? prev.hour : 2;
  const baseMinute = "minute" in prev ? prev.minute : 0;
  switch (next) {
    case "HOURLY":
      return { kind: "HOURLY", minute: baseMinute };
    case "DAILY":
      return { kind: "DAILY", hour: baseHour, minute: baseMinute };
    case "WEEKLY":
      return {
        kind: "WEEKLY",
        hour: baseHour,
        minute: baseMinute,
        days_of_week: prev.kind === "WEEKLY" ? prev.days_of_week : [1],
      };
    case "MONTHLY":
      return {
        kind: "MONTHLY",
        day_of_month:
          prev.kind === "MONTHLY" ? prev.day_of_month : 1,
        hour: baseHour,
        minute: baseMinute,
      };
    case "CUSTOM":
      return {
        kind: "CUSTOM",
        expression:
          prev.kind === "CUSTOM" && prev.expression ? prev.expression : "*/15 * * * *",
      };
    default:
      return prev;
  }
};

export const CronBuilder = ({
  value,
  timezone: tz,
  onChange,
  onTimezoneChange,
}: CronBuilderProps) => {
  const cron = useMemo(() => cadenceToCron(value), [value]);
  const cronError =
    value.kind === "CUSTOM" ? validateCron(value.expression) : null;
  const human = useMemo(() => (cronError ? "" : cronToHuman(cron)), [cron, cronError]);
  const previews = useMemo(
    () => (cronError ? [] : nextRuns(cron, tz, 5)),
    [cron, cronError, tz],
  );

  // If somehow the cadence has no preview-able cron yet, still surface a
  // gentle warning rather than a silent empty state.
  useEffect(() => {
    if (!cron && value.kind !== "CUSTOM") onChange(morphCadence("DAILY", value));
  }, [cron, onChange, value]);

  return (
    <Card
      size="small"
      style={{
        borderRadius: 12,
        background:
          "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(6,182,212,0.04))",
      }}
      bodyStyle={{ padding: 16 }}
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Segmented
          block
          size="middle"
          value={value.kind}
          onChange={(v) => onChange(morphCadence(v as CadenceKind, value))}
          options={KIND_LABELS.map(({ label, value: kind, icon }) => ({
            label: (
              <Space size={6}>
                {icon}
                {label}
              </Space>
            ),
            value: kind,
          }))}
        />

        <Row gutter={[12, 12]}>
          {value.kind === "HOURLY" && (
            <Col span={12}>
              <FieldLabel>Minute of every hour</FieldLabel>
              <InputNumber
                min={0}
                max={59}
                value={value.minute}
                onChange={(n) =>
                  onChange({ kind: "HOURLY", minute: Number(n ?? 0) })
                }
                style={{ width: "100%" }}
              />
            </Col>
          )}

          {value.kind === "DAILY" && (
            <>
              <Col span={12}>
                <FieldLabel>Hour</FieldLabel>
                <InputNumber
                  min={0}
                  max={23}
                  value={value.hour}
                  onChange={(n) => onChange({ ...value, hour: Number(n ?? 0) })}
                  style={{ width: "100%" }}
                />
              </Col>
              <Col span={12}>
                <FieldLabel>Minute</FieldLabel>
                <InputNumber
                  min={0}
                  max={59}
                  value={value.minute}
                  onChange={(n) =>
                    onChange({ ...value, minute: Number(n ?? 0) })
                  }
                  style={{ width: "100%" }}
                />
              </Col>
            </>
          )}

          {value.kind === "WEEKLY" && (
            <>
              <Col span={12}>
                <FieldLabel>Hour</FieldLabel>
                <InputNumber
                  min={0}
                  max={23}
                  value={value.hour}
                  onChange={(n) => onChange({ ...value, hour: Number(n ?? 0) })}
                  style={{ width: "100%" }}
                />
              </Col>
              <Col span={12}>
                <FieldLabel>Minute</FieldLabel>
                <InputNumber
                  min={0}
                  max={59}
                  value={value.minute}
                  onChange={(n) =>
                    onChange({ ...value, minute: Number(n ?? 0) })
                  }
                  style={{ width: "100%" }}
                />
              </Col>
              <Col span={24}>
                <FieldLabel>Days of week</FieldLabel>
                <Space wrap size={6}>
                  {DOW_LABELS.map((label, idx) => {
                    const active = value.days_of_week.includes(idx);
                    return (
                      <Tag.CheckableTag
                        key={label}
                        checked={active}
                        onChange={(checked) => {
                          const next = checked
                            ? [...value.days_of_week, idx]
                            : value.days_of_week.filter((d) => d !== idx);
                          onChange({
                            ...value,
                            days_of_week: next.length === 0 ? [idx] : next,
                          });
                        }}
                        style={{
                          padding: "4px 12px",
                          borderRadius: 999,
                          fontWeight: active ? 600 : 500,
                        }}
                      >
                        {label}
                      </Tag.CheckableTag>
                    );
                  })}
                </Space>
              </Col>
            </>
          )}

          {value.kind === "MONTHLY" && (
            <>
              <Col span={8}>
                <FieldLabel>Day of month</FieldLabel>
                <InputNumber
                  min={1}
                  max={31}
                  value={value.day_of_month}
                  onChange={(n) =>
                    onChange({ ...value, day_of_month: Number(n ?? 1) })
                  }
                  style={{ width: "100%" }}
                />
              </Col>
              <Col span={8}>
                <FieldLabel>Hour</FieldLabel>
                <InputNumber
                  min={0}
                  max={23}
                  value={value.hour}
                  onChange={(n) => onChange({ ...value, hour: Number(n ?? 0) })}
                  style={{ width: "100%" }}
                />
              </Col>
              <Col span={8}>
                <FieldLabel>Minute</FieldLabel>
                <InputNumber
                  min={0}
                  max={59}
                  value={value.minute}
                  onChange={(n) =>
                    onChange({ ...value, minute: Number(n ?? 0) })
                  }
                  style={{ width: "100%" }}
                />
              </Col>
            </>
          )}

          {value.kind === "CUSTOM" && (
            <Col span={24}>
              <FieldLabel>
                Cron expression{" "}
                <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>
                  (5 fields: minute hour day-of-month month day-of-week)
                </Text>
              </FieldLabel>
              <Input
                value={value.expression}
                onChange={(e) =>
                  onChange({ kind: "CUSTOM", expression: e.target.value })
                }
                status={cronError ? "error" : undefined}
                placeholder="*/15 * * * *"
                style={{ fontFamily: "ui-monospace, monospace" }}
              />
              {cronError && (
                <Text type="danger" style={{ fontSize: 12 }}>
                  {cronError}
                </Text>
              )}
            </Col>
          )}

          <Col span={24}>
            <FieldLabel>Timezone</FieldLabel>
            <Select
              showSearch
              value={tz}
              onChange={onTimezoneChange}
              options={COMMON_TIMEZONES}
              style={{ width: "100%" }}
              filterOption={(input, option) =>
                (option?.label as string)
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
          </Col>
        </Row>

        {/* Live preview */}
        <Card
          size="small"
          style={{
            background: "rgba(255,255,255,0.7)",
            borderRadius: 10,
          }}
          bodyStyle={{ padding: 12 }}
        >
          <Space direction="vertical" size={6} style={{ width: "100%" }}>
            <Space wrap>
              <Tag color="geekblue" style={{ fontFamily: "ui-monospace, monospace" }}>
                {cron || "—"}
              </Tag>
              <Tag color="cyan">{tz}</Tag>
            </Space>
            <Text strong style={{ fontSize: 13 }}>
              {human || "Provide a valid cadence to see a description."}
            </Text>
            {previews.length > 0 && (
              <>
                <Title level={5} style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.7 }}>
                  NEXT 5 RUNS
                </Title>
                <Space direction="vertical" size={2}>
                  {previews.map((iso) => (
                    <Text key={iso} style={{ fontSize: 12 }}>
                      <ClockCircleOutlined style={{ marginRight: 6, opacity: 0.6 }} />
                      {dayjs(iso).tz(tz).format("ddd, MMM D YYYY · HH:mm")}{" "}
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        ({tz}) — {dayjs(iso).utc().format("YYYY-MM-DDTHH:mm[Z]")}
                      </Text>
                    </Text>
                  ))}
                </Space>
              </>
            )}
            {cronError && (
              <Alert
                type="error"
                showIcon
                message={cronError}
                style={{ marginTop: 8 }}
              />
            )}
          </Space>
        </Card>
      </Space>
    </Card>
  );
};

const FieldLabel = ({ children }: { children: ReactNode }) => (
  <Text style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
    {children}
  </Text>
);

export default CronBuilder;
