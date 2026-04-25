import { ToolOutlined } from "@ant-design/icons";
import { Card, Space, Typography } from "antd";

import PageHeader from "./PageHeader";

const { Text, Title } = Typography;

type Props = {
  title: string;
  subtitle?: string;
  description?: string;
};

export const ComingSoon = ({ title, subtitle, description }: Props) => (
  <>
    <PageHeader title={title} subtitle={subtitle} />
    <Card>
      <Space size={20} align="start">
        <ToolOutlined style={{ fontSize: 36, color: "#6366f1" }} />
        <Space direction="vertical" size={4}>
          <Title level={4} style={{ margin: 0 }}>
            Module under construction
          </Title>
          <Text type="secondary">
            {description ||
              "This screen is wired to the backend module and will be expanded soon. The underlying APIs are already available."}
          </Text>
        </Space>
      </Space>
    </Card>
  </>
);

export default ComingSoon;
