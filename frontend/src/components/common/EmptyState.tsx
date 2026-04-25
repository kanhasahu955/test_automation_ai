import { Card, Empty } from "antd";
import type { ReactNode } from "react";

type Props = {
  description?: ReactNode;
  /** Optional action button(s) rendered below the description. */
  action?: ReactNode;
  /** Optional minHeight for the card. */
  minHeight?: number;
};

/**
 * Reusable empty-state card used by list pages (projects, flows, …).
 */
export const EmptyState = ({ description, action, minHeight = 240 }: Props) => (
  <Card style={{ minHeight }}>
    <Empty description={description ?? "Nothing here yet."}>{action}</Empty>
  </Card>
);

export default EmptyState;
