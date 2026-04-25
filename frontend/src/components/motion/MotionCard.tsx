import { Card } from "antd";
import type { CardProps } from "antd";
import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

import { tokens } from "@theme/tokens";

type MotionCardProps = CardProps & {
  /** Stagger child cards in a list — pass the index. */
  index?: number;
  /** Lift on hover. Default true. */
  hoverable?: boolean;
  children?: ReactNode;
  containerStyle?: CSSProperties;
};

/**
 * Animated card that fades + slides in on mount and lifts on hover.
 * Use it instead of <Card /> for any "feature card" or hero card.
 */
export const MotionCard = ({
  index = 0,
  hoverable = true,
  children,
  containerStyle,
  ...cardProps
}: MotionCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-40px" }}
    transition={{
      duration: tokens.motion.duration.base,
      ease: tokens.motion.ease,
      delay: Math.min(index * 0.05, 0.4),
    }}
    whileHover={hoverable ? { y: -3 } : undefined}
    style={{ height: "100%", ...containerStyle }}
  >
    <Card
      bordered={false}
      style={{
        borderRadius: tokens.radius.lg,
        boxShadow: tokens.shadow.md,
        background: tokens.color.surface,
        height: "100%",
        ...cardProps.style,
      }}
      {...cardProps}
    >
      {children}
    </Card>
  </motion.div>
);

export default MotionCard;
