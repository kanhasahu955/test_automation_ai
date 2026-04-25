import {
  ApiOutlined,
  AppstoreOutlined,
  BellOutlined,
  BgColorsOutlined,
  DatabaseOutlined,
  RobotOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Card, Col, Layout, Menu, Row } from "antd";
import { useMemo, useState, type ReactElement, type ReactNode } from "react";

import PageHeader from "@components/common/PageHeader";
import ConnectionsSection from "@features/settings/sections/ConnectionsSection";
import LlmSection from "@features/settings/sections/LlmSection";
import NotificationsSection from "@features/settings/sections/NotificationsSection";
import ProfileSection from "@features/settings/sections/ProfileSection";
import ProjectsSection from "@features/settings/sections/ProjectsSection";
import ThemeSection from "@features/settings/sections/ThemeSection";
import UsersSection from "@features/settings/sections/UsersSection";

type SectionKey =
  | "profile"
  | "theme"
  | "llm"
  | "notifications"
  | "projects"
  | "users"
  | "connections";

type SectionDef = {
  key: SectionKey;
  label: string;
  description: string;
  icon: ReactNode;
  render: () => ReactElement;
};

const SECTIONS: SectionDef[] = [
  {
    key: "profile",
    label: "Profile",
    description: "Your account and role.",
    icon: <UserOutlined />,
    render: () => <ProfileSection />,
  },
  {
    key: "theme",
    label: "Theme",
    description: "Appearance, accent colour and density.",
    icon: <BgColorsOutlined />,
    render: () => <ThemeSection />,
  },
  {
    key: "llm",
    label: "LLM",
    description: "Provider, model, credentials and sampling.",
    icon: <RobotOutlined />,
    render: () => <LlmSection />,
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "Channels and event subscriptions.",
    icon: <BellOutlined />,
    render: () => <NotificationsSection />,
  },
  {
    key: "projects",
    label: "Projects",
    description: "Create, rename, archive projects.",
    icon: <AppstoreOutlined />,
    render: () => <ProjectsSection />,
  },
  {
    key: "users",
    label: "Users",
    description: "Invite, role, deactivate users.",
    icon: <TeamOutlined />,
    render: () => <UsersSection />,
  },
  {
    key: "connections",
    label: "Connections",
    description: "Data sources scoped to a project.",
    icon: <DatabaseOutlined />,
    render: () => <ConnectionsSection />,
  },
];

/**
 * One-stop "Setups" panel — every administrative knob the platform exposes
 * lives behind a single left-rail menu. Each section is its own component
 * so any of them can be opened in isolation later without touching this
 * shell.
 */
export const SettingsPage = () => {
  const [active, setActive] = useState<SectionKey>("profile");

  const current = useMemo(
    () => SECTIONS.find((s) => s.key === active) ?? SECTIONS[0],
    [active],
  );

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Configure your profile, theme, AI, notifications, projects, users and connections."
        actions={
          <span style={{ fontSize: 12, color: "var(--qf-text-muted, #94a3b8)" }}>
            <ApiOutlined style={{ marginRight: 6 }} />
            All changes apply instantly across the app
          </span>
        }
      />

      <Layout style={{ background: "transparent" }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={7} lg={6}>
            <Card styles={{ body: { padding: 8 } }}>
              <Menu
                mode="inline"
                selectedKeys={[active]}
                style={{ borderInlineEnd: "none" }}
                onClick={({ key }) => setActive(key as SectionKey)}
                items={SECTIONS.map((section) => ({
                  key: section.key,
                  icon: section.icon,
                  label: (
                    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                      <span style={{ fontWeight: 500 }}>{section.label}</span>
                      <span style={{ fontSize: 12, opacity: 0.65 }}>
                        {section.description}
                      </span>
                    </div>
                  ),
                  style: { height: "auto", padding: "10px 14px" },
                }))}
              />
            </Card>
          </Col>

          <Col xs={24} md={17} lg={18}>
            {current.render()}
          </Col>
        </Row>
      </Layout>
    </div>
  );
};

export default SettingsPage;
