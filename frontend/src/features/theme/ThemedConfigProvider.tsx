import { ConfigProvider } from "antd";
import { useEffect, useMemo, type ReactNode } from "react";

import { useAppSelector } from "@app/store";
import { buildTheme } from "@theme/antdTheme";

type Props = { children: ReactNode };

/**
 * Wraps the app with an `<ConfigProvider>` whose theme is derived from the
 * `theme` Redux slice. Switching mode/accent/density anywhere in the UI
 * re-renders the entire tree with a new theme — no page reload.
 *
 * Side-effect: also keeps `<html data-theme>` in sync so non-AntD CSS (custom
 * gradients, our scrollbars, etc.) can react with attribute selectors.
 */
export const ThemedConfigProvider = ({ children }: Props) => {
  const theme = useAppSelector((s) => s.theme);
  const themeConfig = useMemo(
    () => buildTheme({ mode: theme.mode, accent: theme.accent, density: theme.density }),
    [theme.mode, theme.accent, theme.density],
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme.mode);
    document.documentElement.style.colorScheme = theme.mode;
  }, [theme.mode]);

  return <ConfigProvider theme={themeConfig}>{children}</ConfigProvider>;
};

export default ThemedConfigProvider;
