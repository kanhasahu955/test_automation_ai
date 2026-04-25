import { BaseApiClient } from "./BaseApiClient";

export type AuditLog = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string | null;
};

class Client extends BaseApiClient {
  constructor() {
    super("/audit-logs");
  }

  list(limit = 200): Promise<AuditLog[]> {
    return this.get<AuditLog[]>("", { params: { limit } });
  }
}

const client = new Client();

export const auditLogsApi = {
  list: (limit = 200) => client.list(limit),
};
