import {
  AppstoreOutlined,
  AuditOutlined,
  BarChartOutlined,
  BellOutlined,
  BookOutlined,
  BugOutlined,
  CalendarOutlined,
  CloudServerOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  LogoutOutlined,
  MonitorOutlined,
  NodeIndexOutlined,
  PartitionOutlined,
  PlayCircleOutlined,
  ProjectOutlined,
  RobotOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Avatar, Badge, Dropdown, Layout, Menu, Space, Tooltip, Typography } from "antd";
import type { MenuProps } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, type ReactNode } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@features/auth/useAuth";
import { ROUTES } from "@constants/routes";
import { tokens } from "@theme/tokens";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

type NavItem = { key: string; icon: ReactNode; label: string; group?: string };

const NAV: NavItem[] = [
  { key: ROUTES.DASHBOARD, icon: <DashboardOutlined />, label: "Dashboard", group: "Overview" },
  { key: ROUTES.PROJECTS, icon: <AppstoreOutlined />, label: "Projects", group: "Overview" },
  { key: ROUTES.TEST_CASES, icon: <ExperimentOutlined />, label: "Test Management", group: "Quality" },
  { key: ROUTES.TEST_SUITES, icon: <ExperimentOutlined />, label: "Test Suites", group: "Quality" },
  { key: ROUTES.FLOWS, icon: <NodeIndexOutlined />, label: "No-Code Designer", group: "Quality" },
  { key: ROUTES.AI, icon: <RobotOutlined />, label: "AI Studio", group: "Intelligence" },
  { key: ROUTES.STM, icon: <PartitionOutlined />, label: "STM Converter", group: "Intelligence" },
  { key: ROUTES.PROFILING, icon: <ThunderboltOutlined />, label: "Data Profiling", group: "Data" },
  { key: ROUTES.METADATA, icon: <DatabaseOutlined />, label: "Metadata", group: "Data" },
  { key: ROUTES.QUALITY, icon: <MonitorOutlined />, label: "Quality Monitoring", group: "Data" },
  { key: ROUTES.EXECUTIONS, icon: <PlayCircleOutlined />, label: "Executions", group: "Operations" },
  { key: ROUTES.SCHEDULES, icon: <CalendarOutlined />, label: "Schedules", group: "Operations" },
  { key: ROUTES.REPORTS, icon: <BarChartOutlined />, label: "Reports", group: "Operations" },
  { key: ROUTES.OPERATIONS, icon: <CloudServerOutlined />, label: "Ops Console", group: "Operations" },
  { key: ROUTES.AUDIT_LOGS, icon: <FileSearchOutlined />, label: "Audit Logs", group: "Operations" },
  { key: ROUTES.DOCS, icon: <BookOutlined />, label: "Documentation", group: "Help" },
];

/**
 * Build the AntD Menu items grouped by `NavItem.group`.
 */
const buildMenuItems = (): MenuProps["items"] => {
  const groups = new Map<string, NavItem[]>();
  for (const item of NAV) {
    const g = item.group ?? "More";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(item);
  }
  const items: MenuProps["items"] = [];
  for (const [group, list] of groups.entries()) {
    items.push({
      type: "group",
      key: `grp-${group}`,
      label: (
        <span style={{ fontSize: 11, letterSpacing: "0.12em", color: "rgba(226,232,240,0.45)" }}>
          {group.toUpperCase()}
        </span>
      ),
      children: list.map((n) => ({ key: n.key, icon: n.icon, label: n.label })),
    });
  }
  return items;
};

const SHELL_MENU_ITEMS = buildMenuItems();

export const AppShell = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  const selectedKey = useMemo(() => {
    const match = NAV.find(
      (n) => location.pathname === n.key || location.pathname.startsWith(n.key + "/"),
    );
    return match?.key || ROUTES.DASHBOARD;
  }, [location.pathname]);

  const activeLabel = useMemo(
    () => NAV.find((n) => n.key === selectedKey)?.label || "QualityForge AI",
    [selectedKey],
  );

  const userMenu: MenuProps["items"] = [
    {
      key: "profile",
      label: (
        <Space direction="vertical" size={0} style={{ minWidth: 200 }}>
          <Text strong>{user?.name || "User"}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {user?.email}
          </Text>
        </Space>
      ),
      disabled: true,
    },
    { type: "divider" },
    { key: "docs", icon: <BookOutlined />, label: "Documentation", onClick: () => navigate(ROUTES.DOCS) },
    { key: "settings", icon: <SettingOutlined />, label: "Settings", onClick: () => navigate(ROUTES.SETTINGS) },
    { type: "divider" },
    { key: "logout", icon: <LogoutOutlined />, label: "Sign out", onClick: () => signOut(), danger: true },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        width={272}
        style={{
          background: tokens.gradient.sidebar,
          boxShadow: "4px 0 24px -8px rgba(15, 23, 42, 0.35)",
          position: "relative",
          overflow: "hidden",
        }}
        breakpoint="lg"
        collapsedWidth={0}
      >
        {/* Decorative glow blobs in the sidebar background. */}
        <div
          aria-hidden
          className="qf-blob"
          style={{
            top: -60,
            right: -40,
            width: 220,
            height: 220,
            background: "rgba(99,102,241,0.55)",
          }}
        />
        <div
          aria-hidden
          className="qf-blob"
          style={{
            bottom: -80,
            left: -60,
            width: 240,
            height: 240,
            background: "rgba(6,182,212,0.45)",
            animationDelay: "-6s",
          }}
        />

        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: tokens.motion.ease }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "20px 20px 18px",
            color: "#fff",
            position: "relative",
            zIndex: 1,
          }}
        >
          <motion.div
            whileHover={{ scale: 1.06, rotate: 4 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: tokens.gradient.brand,
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              color: "#fff",
              boxShadow: tokens.shadow.glow,
            }}
          >
            QF
          </motion.div>
          <Space direction="vertical" size={0}>
            <Text strong style={{ color: "#fff", fontSize: 15, letterSpacing: "-0.01em" }}>
              QualityForge AI
            </Text>
            <Text style={{ color: "rgba(226,232,240,0.6)", fontSize: 11 }}>
              Quality Engineering Platform
            </Text>
          </Space>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          style={{ position: "relative", zIndex: 1 }}
        >
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            onClick={({ key }) => navigate(key)}
            items={SHELL_MENU_ITEMS}
            style={{ background: "transparent", borderInlineEnd: 0, padding: "4px 8px 24px" }}
          />
        </motion.div>
      </Sider>

      <Layout>
        <Header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            background: "rgba(255,255,255,0.78)",
            backdropFilter: "blur(14px) saturate(140%)",
            WebkitBackdropFilter: "blur(14px) saturate(140%)",
            borderBottom: "1px solid rgba(226, 232, 240, 0.6)",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <Space size={12}>
            <motion.span
              key={selectedKey}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              style={{ display: "inline-flex", alignItems: "center", gap: 10 }}
            >
              <BugOutlined style={{ color: tokens.color.primary }} />
              <Text strong style={{ fontSize: 16, letterSpacing: "-0.01em" }}>
                {activeLabel}
              </Text>
            </motion.span>
          </Space>
          <Space size={20}>
            <Tooltip title="Documentation">
              <BookOutlined
                className="qf-focusable"
                style={{ fontSize: 18, cursor: "pointer", color: tokens.color.textMuted }}
                onClick={() => navigate(ROUTES.DOCS)}
              />
            </Tooltip>
            <Tooltip title="Notifications">
              <Badge count={0} size="small">
                <BellOutlined
                  className="qf-focusable"
                  style={{ fontSize: 18, cursor: "pointer", color: tokens.color.textMuted }}
                  onClick={() => navigate(ROUTES.NOTIFICATIONS)}
                />
              </Badge>
            </Tooltip>
            <Tooltip title="Projects">
              <ProjectOutlined
                className="qf-focusable"
                style={{ fontSize: 18, cursor: "pointer", color: tokens.color.textMuted }}
                onClick={() => navigate(ROUTES.PROJECTS)}
              />
            </Tooltip>
            <Tooltip title="Audit logs">
              <AuditOutlined
                className="qf-focusable"
                style={{ fontSize: 18, cursor: "pointer", color: tokens.color.textMuted }}
                onClick={() => navigate(ROUTES.AUDIT_LOGS)}
              />
            </Tooltip>
            <Dropdown menu={{ items: userMenu }} trigger={["click"]}>
              <Space style={{ cursor: "pointer" }}>
                <Avatar style={{ background: tokens.gradient.brand, color: "#fff", fontWeight: 600 }}>
                  {user?.name?.[0]?.toUpperCase() || "U"}
                </Avatar>
                <Space direction="vertical" size={0}>
                  <Text strong style={{ lineHeight: 1.1, fontSize: 13 }}>
                    {user?.name}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {user?.role}
                  </Text>
                </Space>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content
          style={{
            padding: 24,
            background: tokens.color.bg,
            backgroundImage: tokens.gradient.aurora,
            backgroundAttachment: "fixed",
            minHeight: "calc(100vh - 64px)",
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{
                duration: tokens.motion.duration.base,
                ease: tokens.motion.ease,
              }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppShell;
