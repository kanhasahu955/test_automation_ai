import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";

import { tokens } from "@theme/tokens";

export type DonutSlice = {
  name: string;
  value: number;
  /** Optional explicit color; otherwise a token color is picked by index. */
  color?: string;
};

type Props = {
  data: DonutSlice[];
  /** Inner radius (px). Default 55. */
  innerRadius?: number;
  /** Outer radius (px). Default 85. */
  outerRadius?: number;
  /** Hide the legend (e.g. when slices have a custom legend). */
  hideLegend?: boolean;
};

const PALETTE = [
  tokens.color.success,
  tokens.color.danger,
  tokens.color.warning,
  tokens.color.primary,
  tokens.color.accent,
  tokens.color.violet,
  tokens.color.pink,
];

/**
 * Donut/pie chart for "share of total" stats (status distribution, run-type
 * mix, queue volume, ...). Slice colors fall back to the project palette
 * so the look stays consistent across pages.
 */
export const DonutChart = ({
  data,
  innerRadius = 55,
  outerRadius = 85,
  hideLegend,
}: Props) => (
  <ResponsiveContainer width="100%" height="100%">
    <PieChart>
      <Pie
        dataKey="value"
        data={data}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        paddingAngle={4}
        stroke="none"
      >
        {data.map((slice, i) => (
          <Cell key={slice.name} fill={slice.color ?? PALETTE[i % PALETTE.length]} />
        ))}
      </Pie>
      <RechartsTooltip />
      {!hideLegend && <Legend wrapperStyle={{ fontSize: 12 }} />}
    </PieChart>
  </ResponsiveContainer>
);

export default DonutChart;
