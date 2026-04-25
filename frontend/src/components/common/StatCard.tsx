import { Card, Space, Typography } from "antd";
import type { ReactNode } from "react";

const { Text, Title } = Typography;

type Props = {
  title: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  accent?: string;
};

export const StatCard = ({ title, value, hint, icon, accent = "#6366f1" }: Props) => (
  <Card style={{ height: "100%" }} styles={{ body: { padding: 20 } }}>
    <Space style={{ width: "100%", justifyContent: "space-between" }}>
      <Text type="secondary" style={{ textTransform: "uppercase", letterSpacing: 0.5, fontSize: 11 }}>
        {title}
      </Text>
      {icon && (
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            background: `${accent}1a`,
            color: accent,
            fontSize: 18,
          }}
        >
          {icon}
        </div>
      )}
    </Space>
    <Title level={2} style={{ margin: "4px 0 0", fontWeight: 700 }}>
      {value}
    </Title>
    {hint && (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {hint}
      </Text>
    )}
  </Card>
);

export default StatCard;
