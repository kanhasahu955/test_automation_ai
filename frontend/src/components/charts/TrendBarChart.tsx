import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { tokens } from "@theme/tokens";

export type TrendPoint = {
  /** X-axis label (e.g. day, hour). */
  label: string;
  passed: number;
  failed: number;
  skipped: number;
  /** Anything else you want to render as a tooltip extra. */
  [key: string]: string | number;
};

type Props = {
  data: TrendPoint[];
  /** Show legend. Default `true`. */
  showLegend?: boolean;
  /** Override colors. */
  colors?: { passed?: string; failed?: string; skipped?: string };
};

/**
 * Stacked bar chart for "passed / failed / skipped" trends — the canonical
 * shape we render on the dashboard, project detail and reports pages.
 *
 * Pure presentational: pass the data in, get a chart out. No store coupling.
 */
export const TrendBarChart = ({ data, showLegend = true, colors }: Props) => {
  const passed = colors?.passed ?? tokens.color.success;
  const failed = colors?.failed ?? tokens.color.danger;
  const skipped = colors?.skipped ?? tokens.color.warning;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barGap={4}>
        <defs>
          <linearGradient id="qf-pass-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={passed} stopOpacity={0.95} />
            <stop offset="100%" stopColor={passed} stopOpacity={0.5} />
          </linearGradient>
          <linearGradient id="qf-fail-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={failed} stopOpacity={0.95} />
            <stop offset="100%" stopColor={failed} stopOpacity={0.5} />
          </linearGradient>
          <linearGradient id="qf-skip-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={skipped} stopOpacity={0.95} />
            <stop offset="100%" stopColor={skipped} stopOpacity={0.5} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={tokens.color.border} vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: tokens.color.border }} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
        <RechartsTooltip
          contentStyle={{
            borderRadius: tokens.radius.md,
            border: `1px solid ${tokens.color.border}`,
            boxShadow: tokens.shadow.sm,
          }}
        />
        {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} />}
        <Bar dataKey="passed" name="Passed" stackId="r" fill="url(#qf-pass-bar)" />
        <Bar dataKey="failed" name="Failed" stackId="r" fill="url(#qf-fail-bar)" />
        <Bar
          dataKey="skipped"
          name="Skipped"
          stackId="r"
          fill="url(#qf-skip-bar)"
          radius={[6, 6, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default TrendBarChart;
