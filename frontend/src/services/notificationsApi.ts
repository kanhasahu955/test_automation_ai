import { BaseApiClient } from "./BaseApiClient";

export type Channel = "EMAIL" | "SLACK" | "TEAMS" | "WEBHOOK";
export type NotificationStatus = "PENDING" | "SENT" | "FAILED";

export type NotificationItem = {
  id: string;
  project_id: string | null;
  channel: Channel;
  recipient: string | null;
  event_type: string | null;
  message: string | null;
  status: NotificationStatus;
  created_at: string | null;
};

export type NotificationCreate = {
  channel: Channel;
  recipient?: string | null;
  event_type?: string | null;
  message?: string | null;
  project_id?: string | null;
};

class Client extends BaseApiClient {
  constructor() {
    super("/notifications");
  }

  list(projectId?: string | null, limit = 200): Promise<NotificationItem[]> {
    return this.get<NotificationItem[]>("", { params: { project_id: projectId ?? undefined, limit } });
  }

  create(payload: NotificationCreate): Promise<NotificationItem> {
    return this.post<NotificationItem>("", payload);
  }
}

const client = new Client();

export const notificationsApi = {
  list: (projectId?: string | null, limit = 200) => client.list(projectId, limit),
  create: (payload: NotificationCreate) => client.create(payload),
};
