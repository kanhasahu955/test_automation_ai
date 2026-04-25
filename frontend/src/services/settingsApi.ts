import { BaseApiClient } from "./BaseApiClient";

export type LlmProvider =
  | "OPENAI"
  | "AZURE_OPENAI"
  | "ANTHROPIC"
  | "OLLAMA"
  | "DISABLED";

export type LlmSettings = {
  enabled: boolean;
  provider: LlmProvider;
  model: string;
  base_url: string;
  temperature: number;
  max_tokens: number;
  timeout_seconds: number;
};

export type LlmSettingsRead = LlmSettings & { api_key_set: boolean };

export type LlmSettingsUpdate = LlmSettings & {
  /**
   * `null`/`undefined` keeps the existing key, an empty string clears it,
   * any other string rotates it.
   */
  api_key?: string | null;
};

export type LlmTestResult = { ok: boolean; message: string; sample?: string | null };

export type NotificationEvents = {
  run_failed: boolean;
  regression_detected: boolean;
  profiling_anomaly: boolean;
  schedule_failed: boolean;
  quality_drop: boolean;
};

export type NotificationChannel = {
  enabled: boolean;
  recipients: string[];
  webhook_url?: string | null;
};

export type NotificationSettings = {
  events: NotificationEvents;
  email: NotificationChannel;
  slack: NotificationChannel;
  teams: NotificationChannel;
  webhook: NotificationChannel;
  digest_email?: string | null;
};

/**
 * Client for `/settings` — global LLM and notification preferences.
 * Reads are open to any authenticated user; writes are admin-gated server-side.
 */
export class SettingsApiClient extends BaseApiClient {
  constructor() {
    super("/settings");
  }

  getLlm(): Promise<LlmSettingsRead> {
    return this.get<LlmSettingsRead>("/llm");
  }

  updateLlm(payload: LlmSettingsUpdate): Promise<LlmSettingsRead> {
    return this.put<LlmSettingsRead, LlmSettingsUpdate>("/llm", payload);
  }

  testLlm(prompt?: string): Promise<LlmTestResult> {
    return this.post<LlmTestResult, { prompt?: string }>("/llm/test", { prompt });
  }

  getNotifications(): Promise<NotificationSettings> {
    return this.get<NotificationSettings>("/notifications");
  }

  updateNotifications(
    payload: NotificationSettings,
  ): Promise<NotificationSettings> {
    return this.put<NotificationSettings, NotificationSettings>(
      "/notifications",
      payload,
    );
  }
}

const client = new SettingsApiClient();

export const settingsApi = {
  getLlm: () => client.getLlm(),
  updateLlm: (payload: LlmSettingsUpdate) => client.updateLlm(payload),
  testLlm: (prompt?: string) => client.testLlm(prompt),
  getNotifications: () => client.getNotifications(),
  updateNotifications: (payload: NotificationSettings) =>
    client.updateNotifications(payload),
};
