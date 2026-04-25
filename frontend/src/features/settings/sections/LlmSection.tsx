import { ApiOutlined, KeyOutlined, RobotOutlined, ThunderboltOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Skeleton,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";
import { useCallback, useEffect, useState } from "react";

import { useAppSelector } from "@app/store";
import FormSection from "@components/forms/FormSection";
import {
  settingsApi,
  type LlmProvider,
  type LlmSettingsRead,
  type LlmTestResult,
} from "@services/settingsApi";
import { getApiErrorMessage } from "@utils/apiErrors";

const { Text, Paragraph } = Typography;

const PROVIDER_OPTIONS: { label: string; value: LlmProvider; hint: string }[] = [
  { label: "OpenAI", value: "OPENAI", hint: "https://api.openai.com/v1" },
  { label: "Azure OpenAI", value: "AZURE_OPENAI", hint: "https://<resource>.openai.azure.com" },
  { label: "Anthropic", value: "ANTHROPIC", hint: "https://api.anthropic.com" },
  { label: "Ollama (local)", value: "OLLAMA", hint: "http://localhost:11434/v1" },
  { label: "Disabled", value: "DISABLED", hint: "Use deterministic fallback only" },
];

type FormShape = {
  enabled: boolean;
  provider: LlmProvider;
  model: string;
  base_url: string;
  api_key: string;
  temperature: number;
  max_tokens: number;
  timeout_seconds: number;
};

/**
 * LLM connection settings — provider, model, key, sampling. The API key is
 * write-only: the form starts blank and we only send a non-empty value when
 * the user explicitly enters one. Existing keys are indicated via a "Key
 * stored" tag.
 */
export const LlmSection = () => {
  const { message } = App.useApp();
  const role = useAppSelector((s) => s.auth.user?.role);
  const isAdmin = role === "ADMIN";

  const [form] = Form.useForm<FormShape>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [data, setData] = useState<LlmSettingsRead | null>(null);
  const [testResult, setTestResult] = useState<LlmTestResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await settingsApi.getLlm();
      setData(cfg);
      form.setFieldsValue({
        enabled: cfg.enabled,
        provider: cfg.provider,
        model: cfg.model,
        base_url: cfg.base_url,
        api_key: "",
        temperature: cfg.temperature,
        max_tokens: cfg.max_tokens,
        timeout_seconds: cfg.timeout_seconds,
      });
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to load LLM settings"));
    } finally {
      setLoading(false);
    }
  }, [form, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async (values: FormShape) => {
    setSaving(true);
    setTestResult(null);
    try {
      const trimmed = (values.api_key || "").trim();
      const updated = await settingsApi.updateLlm({
        enabled: values.enabled,
        provider: values.provider,
        model: values.model,
        base_url: values.base_url,
        temperature: values.temperature,
        max_tokens: values.max_tokens,
        timeout_seconds: values.timeout_seconds,
        api_key: trimmed === "" ? undefined : trimmed,
      });
      setData(updated);
      form.setFieldValue("api_key", "");
      message.success("LLM settings saved.");
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await settingsApi.testLlm();
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, message: getApiErrorMessage(err, "Test failed") });
    } finally {
      setTesting(false);
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
          message="Only administrators can change LLM settings."
        />
      )}

      <Form<FormShape>
        layout="vertical"
        form={form}
        onFinish={onSave}
        disabled={!isAdmin}
      >
        <FormSection
          title={
            <Space>
              <RobotOutlined />
              Provider
            </Space>
          }
          description="Choose which model powers AI generation, scenario suggestions and failure analysis."
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Provider" name="provider" required>
                <Select
                  options={PROVIDER_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  onChange={(value: LlmProvider) => {
                    const hint = PROVIDER_OPTIONS.find((o) => o.value === value)?.hint;
                    if (hint && !value.startsWith("DISAB")) {
                      form.setFieldValue("base_url", hint);
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Enabled"
                name="enabled"
                valuePropName="checked"
                tooltip="When off, the app falls back to deterministic, non-AI behaviour."
              >
                <Switch checkedChildren="On" unCheckedChildren="Off" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Model"
                name="model"
                rules={[{ required: true, message: "Required" }]}
              >
                <Input placeholder="gpt-4o-mini" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label={
                  <Space>
                    <ApiOutlined />
                    Base URL
                  </Space>
                }
                name="base_url"
                rules={[{ required: true, message: "Required" }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </FormSection>

        <FormSection
          title={
            <Space>
              <KeyOutlined />
              Credentials
            </Space>
          }
          description="The API key is stored encrypted. Leave the field blank to keep the existing key."
          withDivider
          actions={
            data?.api_key_set ? (
              <Tag color="success">Key stored</Tag>
            ) : (
              <Tag color="warning">No key on file</Tag>
            )
          }
        >
          <Form.Item
            label="API key"
            name="api_key"
            extra="Tip: enter a single space and save to clear the stored key."
          >
            <Input.Password placeholder="sk-...  (blank = keep current)" autoComplete="off" />
          </Form.Item>
        </FormSection>

        <FormSection
          title={
            <Space>
              <ThunderboltOutlined />
              Sampling
            </Space>
          }
          description="Defaults applied to every AI call unless overridden by a specific feature."
          withDivider
        >
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item label="Temperature" name="temperature">
                <InputNumber min={0} max={2} step={0.05} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Max tokens" name="max_tokens">
                <InputNumber min={64} max={32000} step={64} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Timeout (seconds)" name="timeout_seconds">
                <InputNumber min={5} max={300} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
        </FormSection>

        <Space style={{ marginTop: 16 }}>
          <Button type="primary" htmlType="submit" loading={saving} disabled={!isAdmin}>
            Save changes
          </Button>
          <Button onClick={onTest} loading={testing} disabled={!isAdmin}>
            Run smoke test
          </Button>
        </Space>
      </Form>

      {testResult && (
        <Alert
          style={{ marginTop: 16 }}
          showIcon
          type={testResult.ok ? "success" : "error"}
          message={testResult.message}
          description={
            testResult.sample ? (
              <Paragraph style={{ marginBottom: 0 }}>
                <Text type="secondary">LLM sample reply:</Text>{" "}
                <Text code>{testResult.sample}</Text>
              </Paragraph>
            ) : undefined
          }
        />
      )}
    </Card>
  );
};

export default LlmSection;
