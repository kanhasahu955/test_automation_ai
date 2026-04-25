import { Divider, Space, Typography } from "antd";
import type { ReactNode } from "react";

import { tokens } from "@theme/tokens";

const { Text, Title } = Typography;

type Props = {
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned slot for action buttons / toggles. */
  actions?: ReactNode;
  /** When true, renders a thin divider above the section. */
  withDivider?: boolean;
  children: ReactNode;
};

/**
 * Visual grouping for related form fields. Long forms are easier to scan
 * when they're broken into 3-5 named sections instead of a flat 20-field wall.
 *
 * Use sparingly — pages with a single quick form don't need this.
 */
export const FormSection = ({
  title,
  description,
  actions,
  withDivider,
  children,
}: Props) => (
  <div style={{ marginBottom: 16 }}>
    {withDivider && <Divider style={{ margin: "16px 0" }} />}
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 8,
      }}
    >
      <Space direction="vertical" size={2}>
        <Title level={5} style={{ margin: 0 }}>
          {title}
        </Title>
        {description && (
          <Text type="secondary" style={{ fontSize: 13 }}>
            {description}
          </Text>
        )}
      </Space>
      {actions && <div>{actions}</div>}
    </div>
    <div
      style={{
        background: tokens.color.surface,
        borderRadius: tokens.radius.md,
      }}
    >
      {children}
    </div>
  </div>
);

export default FormSection;
