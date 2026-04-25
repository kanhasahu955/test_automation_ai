import { Space, Typography } from "antd";
import type { ReactNode } from "react";

const { Title, Text } = Typography;

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export const PageHeader = ({ title, subtitle, actions }: Props) => (
  <div
    style={{
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 16,
      flexWrap: "wrap",
      marginBottom: 20,
    }}
  >
    <Space direction="vertical" size={2}>
      <Title level={3} style={{ margin: 0 }}>
        {title}
      </Title>
      {subtitle && <Text type="secondary">{subtitle}</Text>}
    </Space>
    {actions && <Space wrap>{actions}</Space>}
  </div>
);

export default PageHeader;
