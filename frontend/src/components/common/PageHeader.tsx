import { Space, Typography } from "antd";
import type { ReactNode } from "react";

const { Title, Text } = Typography;

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export const PageHeader = ({ title, subtitle, actions }: Props) => (
  <div className="mb-5 flex w-full min-w-0 flex-col gap-3 sm:mb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
    <Space direction="vertical" size={2} className="min-w-0 flex-1">
      <Title level={3} className="!m-0 !text-[1.15rem] !leading-snug sm:!text-2xl">
        {title}
      </Title>
      {subtitle && (
        <Text type="secondary" className="!text-sm sm:!text-base">
          {subtitle}
        </Text>
      )}
    </Space>
    {actions && (
      <Space className="!w-full !flex-wrap !gap-2 sm:!w-auto" wrap>
        {actions}
      </Space>
    )}
  </div>
);

export default PageHeader;
