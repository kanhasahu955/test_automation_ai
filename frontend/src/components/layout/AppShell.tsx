import {
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  CloudServerOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DownOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  LogoutOutlined,
  MonitorOutlined,
  NodeIndexOutlined,
  PartitionOutlined,
  PlayCircleOutlined,
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

const SIDER_WIDTH = 272;

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

/** Build the AntD Menu items grouped by `NavItem.group`. */
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
        <span className="text-[11px] tracking-[0.12em] text-white/45">
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

  const activeNav = useMemo(() => NAV.find((n) => n.key === selectedKey), [selectedKey]);
  const activeLabel = activeNav?.label || "QualityForge AI";
  const activeIcon = activeNav?.icon ?? <DashboardOutlined />;

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
    <Layout className="min-h-screen" hasSider>
      {/*
        The Sider is `position: sticky` so it stays pinned while the inner
        Layout scrolls. AntD's <Sider> exposes `style` only via the
        `style` prop, so we set sticky positioning there and use Tailwind
        for the inner layout (column flex with a scrollable menu region).
      */}
      <Sider
        width={SIDER_WIDTH}
        breakpoint="lg"
        collapsedWidth={0}
        className="!shadow-[4px_0_24px_-8px_rgba(15,23,42,0.35)]"
        style={{
          background: tokens.gradient.sidebar,
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
        }}
      >
        {/* Animated brand glow blobs (kept as CSS — keyframe animation). */}
        <div
          aria-hidden
          className="qf-blob"
          style={{ top: -60, right: -40, width: 220, height: 220, background: "rgba(99,102,241,0.55)" }}
        />
        <div
          aria-hidden
          className="qf-blob"
          style={{ bottom: -80, left: -60, width: 240, height: 240, background: "rgba(6,182,212,0.45)", animationDelay: "-6s" }}
        />

        <div className="relative z-[1] flex h-full flex-col">
          {/* Brand block — pinned at top of sidebar. */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: tokens.motion.ease }}
            className="flex flex-none items-center gap-3 px-5 pt-5 pb-4 text-white"
          >
            <motion.div
              whileHover={{ scale: 1.06, rotate: 4 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className="grid h-[42px] w-[42px] place-items-center rounded-xl font-bold text-white"
              style={{ background: tokens.gradient.brand, boxShadow: tokens.shadow.glow }}
            >
              QF
            </motion.div>
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-semibold tracking-tight text-white">QualityForge AI</span>
              <span className="text-[11px] text-white/60">Quality Engineering Platform</span>
            </div>
          </motion.div>

          {/* Menu — scrolls internally when nav is taller than viewport. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pb-6"
          >
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[selectedKey]}
              onClick={({ key }) => navigate(key)}
              items={SHELL_MENU_ITEMS}
              style={{ background: "transparent", borderInlineEnd: 0 }}
              className="!px-2 !pt-1"
            />
          </motion.div>
        </div>
      </Sider>

      <Layout>
        <Header
          className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200/60 bg-white/80 px-6 backdrop-blur-md backdrop-saturate-150"
          style={{ height: 64, lineHeight: "64px" }}
        >
          {/* Active page badge + label. */}
          <motion.div
            key={selectedKey}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="inline-flex min-w-0 flex-shrink items-center gap-2.5"
          >
            <span
              aria-hidden
              className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-base text-primary"
              style={{ background: tokens.gradient.brandSoft }}
            >
              {activeIcon}
            </span>
            <Text strong className="!truncate !text-base !leading-tight !tracking-tight">
              {activeLabel}
            </Text>
          </motion.div>

          {/* Right cluster — quick links + user pill. */}
          <div className="inline-flex flex-none items-center gap-2">
            <Tooltip title="Documentation">
              <button
                type="button"
                aria-label="Documentation"
                onClick={() => navigate(ROUTES.DOCS)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border-0 bg-transparent text-slate-600 transition-colors duration-150 hover:bg-primary/10 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <BookOutlined style={{ fontSize: 18 }} />
              </button>
            </Tooltip>

            <Tooltip title="Notifications">
              <button
                type="button"
                aria-label="Notifications"
                onClick={() => navigate(ROUTES.NOTIFICATIONS)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border-0 bg-transparent text-slate-600 transition-colors duration-150 hover:bg-primary/10 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Badge count={0} size="small" offset={[-2, 2]}>
                  <BellOutlined style={{ fontSize: 18 }} />
                </Badge>
              </button>
            </Tooltip>

            <Tooltip title="Settings">
              <button
                type="button"
                aria-label="Settings"
                onClick={() => navigate(ROUTES.SETTINGS)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border-0 bg-transparent text-slate-600 transition-colors duration-150 hover:bg-primary/10 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <SettingOutlined style={{ fontSize: 18 }} />
              </button>
            </Tooltip>

            <span aria-hidden className="mx-1 h-6 w-px bg-slate-900/10" />

            <Dropdown menu={{ items: userMenu }} trigger={["click"]} placement="bottomRight">
              <button
                type="button"
                aria-label="Account menu"
                className="inline-flex max-w-[240px] items-center gap-2.5 rounded-full border border-primary/15 bg-primary/5 py-1 pl-1 pr-3.5 transition-colors duration-150 hover:border-primary/30 hover:bg-primary/10"
              >
                <Avatar
                  size={32}
                  style={{ background: tokens.gradient.brand, color: "#fff", fontWeight: 600, flex: "0 0 auto" }}
                >
                  {user?.name?.[0]?.toUpperCase() || "U"}
                </Avatar>
                <span className="hidden min-w-0 flex-col leading-[1.15] sm:flex">
                  <span className="max-w-[140px] truncate text-[13px] font-semibold text-slate-900">
                    {user?.name || "Account"}
                  </span>
                  {user?.role && (
                    <span className="max-w-[140px] truncate text-[10.5px] uppercase tracking-wider text-slate-600">
                      {user.role}
                    </span>
                  )}
                </span>
                <DownOutlined style={{ fontSize: 10, color: tokens.color.textMuted }} />
              </button>
            </Dropdown>
          </div>
        </Header>

        <Content
          className="p-6"
          style={{
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
              transition={{ duration: tokens.motion.duration.base, ease: tokens.motion.ease }}
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
