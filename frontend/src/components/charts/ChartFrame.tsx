import { Empty, Skeleton } from "antd";
import type { ReactNode } from "react";

import MotionCard from "@components/motion/MotionCard";

type Props = {
  /** Card heading. */
  title: ReactNode;
  /** Optional subtitle / chip rendered in the card's `extra` slot. */
  extra?: ReactNode;
  /** Pixel height of the chart canvas (excluding card chrome). Default 280. */
  height?: number;
  /** When true, swap the chart for a skeleton placeholder. */
  loading?: boolean;
  /** When true, render an Empty state instead of `children`. */
  empty?: boolean;
  /** Custom empty description. */
  emptyDescription?: ReactNode;
  /** Stagger index passed to {@link MotionCard}. */
  index?: number;
  /** The actual `<recharts>` element. */
  children: ReactNode;
};

/**
 * Standard frame that **every** chart in the app uses.
 *
 * Why a wrapper?
 * - Guarantees a consistent header / loading / empty UX across every page.
 * - Locks the chart into a `ResponsiveContainer`-friendly fixed height.
 * - One place to swap the motion / shadow language later.
 */
export const ChartFrame = ({
  title,
  extra,
  height = 280,
  loading,
  empty,
  emptyDescription = "No data yet.",
  index = 0,
  children,
}: Props) => (
  <MotionCard index={index} title={title} extra={extra} loading={false}>
    <div style={{ height }}>
      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : empty ? (
        <div style={{ height: "100%", display: "grid", placeItems: "center" }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription} />
        </div>
      ) : (
        children
      )}
    </div>
  </MotionCard>
);

export default ChartFrame;
