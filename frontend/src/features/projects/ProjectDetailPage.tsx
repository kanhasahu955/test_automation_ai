import { Card, Col, Descriptions, Row, Tag } from "antd";
import { useEffect } from "react";
import { useParams } from "react-router-dom";

import PageHeader from "@components/common/PageHeader";
import { useAppDispatch, useAppSelector } from "@app/store";
import { fetchProjectRequest } from "./projectsSlice";

export const ProjectDetailPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const dispatch = useAppDispatch();
  const project = useAppSelector((s) => s.projects.selected);

  useEffect(() => {
    if (projectId) dispatch(fetchProjectRequest(projectId));
  }, [projectId, dispatch]);

  return (
    <div>
      <PageHeader title={project?.name || "Project"} subtitle={project?.description} />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="Project info">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Status">
                <Tag color={project?.status === "ACTIVE" ? "success" : "default"}>
                  {project?.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Owner">{project?.owner_id || "—"}</Descriptions.Item>
              <Descriptions.Item label="Created">
                {project?.created_at ? new Date(project.created_at).toLocaleString() : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Updated">
                {project?.updated_at ? new Date(project.updated_at).toLocaleString() : "—"}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ProjectDetailPage;
