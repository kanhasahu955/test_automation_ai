import { PlusOutlined } from "@ant-design/icons";
import { Button, Card, Col, Empty, Row, Space, Tag, Typography } from "antd";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import PageHeader from "@components/common/PageHeader";
import ProjectPicker from "@components/common/ProjectPicker";
import SelectProjectHint from "@components/common/SelectProjectHint";
import { ROUTES } from "@constants/routes";
import { useAppDispatch, useAppSelector } from "@app/store";
import { useSelectedProject } from "@hooks/useSelectedProject";
import { fetchListRequest } from "./flowsSlice";

const { Text, Title } = Typography;

export const FlowsListPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { hasProject, projectId } = useSelectedProject();
  const { items, loading } = useAppSelector((s) => s.flows);

  useEffect(() => {
    if (projectId) dispatch(fetchListRequest(projectId));
  }, [projectId, dispatch]);

  return (
    <div>
      <PageHeader
        title="No-Code Flows"
        subtitle="Reusable executable test flows authored visually."
        actions={
          <Space>
            <ProjectPicker />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate(ROUTES.FLOW_NEW)}
              disabled={!hasProject}
            >
              New flow
            </Button>
          </Space>
        }
      />

      {!hasProject && <SelectProjectHint message="Select a project to view flows." />}

      {items.length === 0 && hasProject && !loading ? (
        <Card>
          <Empty
            description={
              <Space direction="vertical" align="center">
                <Title level={4} style={{ margin: 0 }}>
                  No flows yet
                </Title>
                <Text type="secondary">
                  Build your first no-code flow to automate UI, API or SQL checks.
                </Text>
              </Space>
            }
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate(ROUTES.FLOW_NEW)}
            >
              Create flow
            </Button>
          </Empty>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {items.map((flow) => (
            <Col xs={24} sm={12} md={8} key={flow.id}>
              <Card
                hoverable
                onClick={() => navigate(ROUTES.FLOW_DETAIL(flow.id))}
                loading={loading}
              >
                <Space style={{ width: "100%", justifyContent: "space-between" }} align="start">
                  <Title level={4} style={{ margin: 0 }}>
                    {flow.name}
                  </Title>
                  <Tag color="processing">{flow.runtime}</Tag>
                </Space>
                <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 8 }}>
                  {flow.created_at ? new Date(flow.created_at).toLocaleString() : ""}
                </Text>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export default FlowsListPage;
