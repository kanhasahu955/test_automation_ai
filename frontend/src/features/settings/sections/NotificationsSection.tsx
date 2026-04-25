import {
  ApiOutlined,
  BellOutlined,
  MailOutlined,
  MessageOutlined,
  SlackOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Skeleton,
  Space,
  Switch,
  Typography,
} from "antd";
import { useCallback, useEffect, useState, type ReactElement } from "react";

import { useAppSelector } from "@app/store";
import FormSection from "@components/forms/FormSection";
import {
  settingsApi,
  type NotificationChannel,
  type NotificationSettings,
} from "@services/settingsApi";
import { getApiErrorMessage } from "@utils/apiErrors";

const { Text } = Typography;

const EVENT_OPTIONS: { key: keyof NotificationSettings["events"]; label: string; hint: string }[] = [
  { key: "run_failed", label: "Run failed", hint: "Any execution finishing in FAILED status." },
  { key: "regression_detected", label: "Regression detected", hint: "Tests that passed before but failed now." },
  { key: "profiling_anomaly", label: "Profiling anomaly", hint: "Statistical drifts caught by profiling." },
  { key: "schedule_failed", label: "Schedule failed", hint: "A cron-driven run could not start or finished failed." },
  { key: "quality_drop", label: "Quality drop", hint: "Aggregate quality score regressed past the threshold." },
];

type ChannelKey = "email" | "slack" | "teams" | "webhook";

const CHANNELS: { key: ChannelKey; label: string; icon: ReactElement; hasWebhook: boolean }[] = [
  { key: "email", label: "Email", icon: <MailOutlined />, hasWebhook: false },
  { key: "slack", label: "Slack", icon: <SlackOutlined />, hasWebhook: true },
  { key: "teams", label: "Microsoft Teams", icon: <MessageOutlined />, hasWebhook: true },
  { key: "webhook", label: "Generic webhook", icon: <ApiOutlined />, hasWebhook: true },
];

const emptyChannel = (): NotificationChannel => ({
  enabled: false,
  recipients: [],
  webhook_url: null,
});

const defaultSettings = (): NotificationSettings => ({
  events: {
    run_failed: true,
    regression_detected: true,
    profiling_anomaly: true,
    schedule_failed: true,
    quality_drop: true,
  },
  email: emptyChannel(),
  slack: emptyChannel(),
  teams: emptyChannel(),
  webhook: emptyChannel(),
  digest_email: null,
});

export const NotificationsSection = () => {
  const { message } = App.useApp();
  const role = useAppSelector((s) => s.auth.user?.role);
  const isAdmin = role === "ADMIN";

  const [form] = Form.useForm<NotificationSettings>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await settingsApi.getNotifications();
      form.setFieldsValue(cfg);
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to load notification settings"));
      form.setFieldsValue(defaultSettings());
    } finally {
      setLoading(false);
    }
  }, [form, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async (values: NotificationSettings) => {
    setSaving(true);
    try {
      const next = await settingsApi.updateNotifications(values);
      form.setFieldsValue(next);
      message.success("Notification settings saved.");
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to save notification settings"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <Skeleton active />
      </Card>
    );
  }

  return (
    <Card>
      {!isAdmin && (
        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 16 }}
          message="Only administrators can change notification preferences."
        />
      )}

      <Form<NotificationSettings>
        layout="vertical"
        form={form}
        onFinish={onSave}
        disabled={!isAdmin}
      >
        <FormSection
          title={
            <Space>
              <BellOutlined />
              Events
            </Space>
          }
          description="Pick which events should trigger notifications. Channels below decide where they go."
        >
          <Row gutter={[16, 8]}>
            {EVENT_OPTIONS.map((opt) => (
              <Col key={opt.key} xs={24} md={12}>
                <Form.Item
                  label={
                    <Space direction="vertical" size={0}>
                      <Text strong>{opt.label}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {opt.hint}
                      </Text>
                    </Space>
                  }
                  name={["events", opt.key]}
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              </Col>
            ))}
          </Row>
        </FormSection>

        {CHANNELS.map((channel) => (
          <FormSection
            key={channel.key}
            title={
              <Space>
                {channel.icon}
                {channel.label}
              </Space>
            }
            description={
              channel.hasWebhook
                ? `Send events to a ${channel.label} incoming webhook.`
                : "Send digest emails to one or more recipients."
            }
            withDivider
            actions={
              <Form.Item
                name={[channel.key, "enabled"]}
                valuePropName="checked"
                style={{ margin: 0 }}
              >
                <Switch checkedChildren="On" unCheckedChildren="Off" />
              </Form.Item>
            }
          >
            <Row gutter={16}>
              {channel.hasWebhook && (
                <Col xs={24}>
                  <Form.Item
                    label="Webhook URL"
                    name={[channel.key, "webhook_url"]}
                    rules={[{ type: "url", message: "Must be a valid URL" }]}
                  >
                    <Input placeholder="https://hooks.slack.com/services/..." />
                  </Form.Item>
                </Col>
              )}
              <Col xs={24}>
                <Form.Item
                  label="Recipients"
                  name={[channel.key, "recipients"]}
                  tooltip="Press Enter after each recipient. Emails for the email channel; user IDs/handles for chat."
                >
                  <Select
                    mode="tags"
                    tokenSeparators={[",", " "]}
                    placeholder="Add recipients…"
                  />
                </Form.Item>
              </Col>
            </Row>
          </FormSection>
        ))}

        <FormSection
          title="Daily digest"
          description="Optional inbox where a once-a-day summary of all events is mailed."
          withDivider
        >
          <Form.Item
            label="Digest email"
            name="digest_email"
            rules={[{ type: "email", message: "Must be an email" }]}
          >
            <Input placeholder="qa-team@yourcompany.com" allowClear />
          </Form.Item>
        </FormSection>

        <Space>
          <Button type="primary" htmlType="submit" loading={saving} disabled={!isAdmin}>
            Save preferences
          </Button>
          <Button onClick={load} disabled={!isAdmin}>
            Discard changes
          </Button>
        </Space>
      </Form>
    </Card>
  );
};

export default NotificationsSection;
