import { Card, Col, Descriptions, Empty, List, Row, Tag, Typography } from "antd";
import { useEffect } from "react";
import { useParams } from "react-router-dom";

import PageHeader from "@components/common/PageHeader";
import { useAppDispatch, useAppSelector } from "@app/store";
import { fetchOneRequest } from "./testCasesSlice";

const { Text } = Typography;

export const TestCaseDetailPage = () => {
  const { testCaseId } = useParams<{ testCaseId: string }>();
  const dispatch = useAppDispatch();
  const { current, loading } = useAppSelector((s) => s.testCases);

  useEffect(() => {
    if (testCaseId) dispatch(fetchOneRequest(testCaseId));
  }, [testCaseId, dispatch]);

  return (
    <div>
      <PageHeader title={current?.title || "Test case"} subtitle={current?.description} />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={10}>
          <Card title="Metadata" loading={loading && !current}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Type">
                <Tag>{current?.test_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Priority">
                <Tag>{current?.priority}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={current?.status === "READY" ? "success" : "default"}>
                  {current?.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Preconditions">
                {current?.preconditions || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Expected">
                {current?.expected_result || "—"}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} md={14}>
          <Card title="Steps" loading={loading && !current}>
            {(current?.steps?.length ?? 0) === 0 ? (
              <Empty description="No steps configured" />
            ) : (
              <List
                dataSource={current?.steps || []}
                renderItem={(step) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Text strong>
                          {step.step_order}. {step.action}
                        </Text>
                      }
                      description={step.expected_result}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TestCaseDetailPage;
