import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { tokens } from "@theme/tokens";

type Props = {
  /** Numeric series — index becomes the X axis. */
  data: number[];
  /** Stroke + fill color. Default = primary. */
  color?: string;
  /** Pixel height — default 36. Sparklines are designed to live inside cards. */
  height?: number;
};

/**
 * Compact, decoration-only inline area chart. Use it inside a {@link StatCard}
 * to give a quick visual cue for a metric without crowding the layout.
 *
 * @example
 *   <MiniSparkline data={[2, 4, 5, 8, 7, 11, 13]} />
 */
export const MiniSparkline = ({ data, color = tokens.color.primary, height = 36 }: Props) => {
  const series = data.map((v, i) => ({ x: i, v }));
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <AreaChart data={series} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`qf-spark-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill={`url(#qf-spark-${color})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MiniSparkline;
