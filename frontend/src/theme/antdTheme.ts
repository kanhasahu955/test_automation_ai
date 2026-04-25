import type { ThemeConfig } from "antd";
import { theme as antdTheme } from "antd";

import type { ThemeDensity, ThemeMode } from "@features/theme/themeSlice";
import { tokens } from "@theme/tokens";

export type ThemeOptions = {
  mode: ThemeMode;
  accent: string;
  density: ThemeDensity;
};

/**
 * Build the Ant Design theme dynamically based on user preferences (mode,
 * accent, density). The base palette/radii live in `tokens.ts`; this just
 * swaps the parts that change at runtime.
 */
export function buildTheme(opts: ThemeOptions): ThemeConfig {
  const isDark = opts.mode === "dark";
  const algorithm = isDark
    ? [antdTheme.darkAlgorithm]
    : [antdTheme.defaultAlgorithm];
  if (opts.density === "compact") algorithm.push(antdTheme.compactAlgorithm);

  return {
    algorithm,
    token: {
      colorPrimary: opts.accent,
      colorInfo: tokens.color.accent,
      colorSuccess: tokens.color.success,
      colorWarning: tokens.color.warning,
      colorError: tokens.color.danger,
      colorBgLayout: isDark ? "#0b1020" : tokens.color.bg,
      colorTextBase: isDark ? "#e2e8f0" : tokens.color.text,
      colorBorder: isDark ? "#1f2742" : tokens.color.border,
      colorBorderSecondary: isDark ? "#1a2038" : "#eef0f7",
      borderRadius: tokens.radius.md,
      borderRadiusLG: tokens.radius.lg,
      fontFamily:
        "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: 14,
      motionDurationMid: "0.24s",
      motionDurationSlow: "0.36s",
      motionEaseInOut: "cubic-bezier(0.22, 1, 0.36, 1)",
      boxShadow: tokens.shadow.sm,
      boxShadowSecondary: tokens.shadow.md,
    },
    components: {
      Layout: {
        headerBg: isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.78)",
        headerHeight: 64,
        siderBg: tokens.color.sidebarFrom,
        bodyBg: isDark ? "#0b1020" : tokens.color.bg,
      },
      Menu: {
        darkItemBg: "transparent",
        darkSubMenuItemBg: "transparent",
        darkItemSelectedBg: "rgba(99,102,241,0.28)",
        darkItemHoverBg: "rgba(99,102,241,0.16)",
        darkItemColor: "rgba(226,232,240,0.85)",
        darkItemSelectedColor: "#ffffff",
        itemBorderRadius: tokens.radius.sm,
        itemHeight: 42,
        iconSize: 16,
      },
      Card: {
        borderRadiusLG: tokens.radius.lg,
        paddingLG: 22,
        headerBg: "transparent",
        boxShadow: tokens.shadow.md,
        boxShadowTertiary: tokens.shadow.sm,
      },
      Button: {
        controlHeight: 38,
        borderRadius: tokens.radius.sm,
        fontWeight: 500,
        primaryShadow: "0 4px 14px -4px rgba(99,102,241,0.5)",
      },
      Table: {
        headerBg: isDark ? "#10162b" : "#f1f5f9",
        headerColor: isDark ? "#94a3b8" : tokens.color.textMuted,
        borderColor: isDark ? "#1f2742" : tokens.color.border,
        rowHoverBg: isDark ? "#10162b" : "#f8fafc",
        headerSplitColor: "transparent",
      },
      Modal: {
        borderRadiusLG: tokens.radius.lg,
        paddingContentHorizontalLG: 24,
      },
      Input: {
        borderRadius: tokens.radius.sm,
        controlHeight: 38,
      },
      Select: {
        borderRadius: tokens.radius.sm,
        controlHeight: 38,
      },
      Tabs: {
        itemActiveColor: opts.accent,
        itemSelectedColor: opts.accent,
        inkBarColor: opts.accent,
        titleFontSize: 14,
      },
      Tag: {
        borderRadiusSM: tokens.radius.sm,
      },
      Tooltip: {
        borderRadius: tokens.radius.sm,
      },
      Drawer: {
        borderRadiusLG: tokens.radius.lg,
      },
      Notification: {
        borderRadiusLG: tokens.radius.md,
      },
    },
  };
}

/** Default fallback theme — matches the persisted-store initial state. */
export const qfTheme: ThemeConfig = buildTheme({
  mode: "light",
  accent: tokens.color.primary,
  density: "comfortable",
});
