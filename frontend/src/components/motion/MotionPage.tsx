import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

import { tokens } from "@theme/tokens";

type MotionPageProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
};

/**
 * Wraps a route page with a fade + slide entrance.
 *
 * Combine with the `<AnimatePresence />` in `AppShell` so transitions
 * play when navigating between routes.
 */
export const MotionPage = ({ children, style, ...rest }: MotionPageProps) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: tokens.motion.duration.base, ease: tokens.motion.ease }}
    style={{ width: "100%", ...style }}
    {...rest}
  >
    {children}
  </motion.div>
);

export default MotionPage;
