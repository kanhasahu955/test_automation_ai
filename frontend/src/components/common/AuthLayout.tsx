import { Card, Space, Typography } from "antd";
import type { ReactNode } from "react";

const { Title, Text } = Typography;

type Props = {
  title: string;
  subtitle?: string;
  width?: number;
  children: ReactNode;
  /** Footer slot — typically a Sign-up / Sign-in link. */
  footer?: ReactNode;
  /** Show the QF logo/wordmark next to the title. */
  showLogo?: boolean;
};

/**
 * Shared visual shell for `LoginPage` and `RegisterPage`.
 * Uses the `qfTheme` brand gradient + frosted card, centered on viewport.
 */
export const AuthLayout = ({
  title,
  subtitle,
  width = 420,
  children,
  footer,
  showLogo = true,
}: Props) => (
  <div
    className="box-border p-4 sm:p-6"
    style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background:
        "radial-gradient(circle at 20% 20%, rgba(99,102,241,0.20), transparent 50%), radial-gradient(circle at 80% 80%, rgba(6,182,212,0.20), transparent 50%), #0f172a",
    }}
  >
    <Card
      className="w-full"
      style={{ maxWidth: width, boxShadow: "0 30px 60px rgba(15,23,42,0.4)" }}
    >
      <Space direction="vertical" size={6} style={{ width: "100%", marginBottom: 20 }}>
        <Space>
          {showLogo && (
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
              }}
            >
              QF
            </div>
          )}
          <Title level={3} style={{ margin: 0 }}>
            {title}
          </Title>
        </Space>
        {subtitle && <Text type="secondary">{subtitle}</Text>}
      </Space>

      {children}

      {footer && (
        <Text type="secondary" style={{ display: "block", textAlign: "center" }}>
          {footer}
        </Text>
      )}
    </Card>
  </div>
);

export default AuthLayout;
