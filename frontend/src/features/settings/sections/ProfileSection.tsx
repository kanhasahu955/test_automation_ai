import { MailOutlined, SafetyCertificateOutlined, UserOutlined } from "@ant-design/icons";
import { Avatar, Card, Descriptions, Space, Tag, Typography } from "antd";

import { useAppSelector } from "@app/store";
import { tokens } from "@theme/tokens";

const { Text, Paragraph } = Typography;

const ROLE_COLOR: Record<string, string> = {
  ADMIN: "magenta",
  QA_MANAGER: "geekblue",
  QA_ENGINEER: "blue",
  DATA_ENGINEER: "cyan",
  DEVELOPER: "purple",
};

/**
 * Read-only summary of the signed-in user. Editing email/password is handled
 * by the auth flow rather than the settings screen so that mutations always
 * go through a verified path.
 */
export const ProfileSection = () => {
  const user = useAppSelector((s) => s.auth.user);

  if (!user) {
    return (
      <Card>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          You are not signed in.
        </Paragraph>
      </Card>
    );
  }

  const initials = (user.name || user.email || "?")
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Card>
      <Space size={20} align="start" style={{ width: "100%" }}>
        <Avatar
          size={72}
          style={{ background: tokens.gradient.brand, fontSize: 24, fontWeight: 600 }}
        >
          {initials}
        </Avatar>
        <Space direction="vertical" size={4} style={{ flex: 1 }}>
          <Text strong style={{ fontSize: 18 }}>
            {user.name}
          </Text>
          <Text type="secondary">
            <MailOutlined style={{ marginRight: 6 }} />
            {user.email}
          </Text>
          <Space size={8} style={{ marginTop: 8 }}>
            <Tag color={ROLE_COLOR[user.role] || "default"} icon={<SafetyCertificateOutlined />}>
              {user.role}
            </Tag>
            <Tag color={user.is_active ? "success" : "default"} icon={<UserOutlined />}>
              {user.is_active ? "Active" : "Inactive"}
            </Tag>
          </Space>
        </Space>
      </Space>

      <Descriptions
        size="small"
        column={1}
        bordered
        style={{ marginTop: 24 }}
        labelStyle={{ width: 160 }}
      >
        <Descriptions.Item label="User ID">
          <Text code>{user.id}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Created">
          {user.created_at ? new Date(user.created_at).toLocaleString() : "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Last updated">
          {user.updated_at ? new Date(user.updated_at).toLocaleString() : "—"}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
};

export default ProfileSection;
