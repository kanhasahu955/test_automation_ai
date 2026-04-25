import {
  CheckCircleOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  EditOutlined,
  FileAddOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  App,
  Badge,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Steps,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from "antd";
import type { UploadProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { DataTable } from "@components/tables";
import { FormSection, required } from "@components/forms";
import PageHeader from "@components/common/PageHeader";
import ProjectPicker from "@components/common/ProjectPicker";
import SelectProjectHint from "@components/common/SelectProjectHint";

import { useAppDispatch, useAppSelector } from "@app/store";
import {
  dataSourcesApi,
  type DataSource,
} from "@services/dataSourcesApi";
import type {
  StmDocument,
  StmMapping,
  StmMappingCreatePayload,
  StmValidationType,
} from "@services/stmApi";
import { tokens } from "@theme/tokens";

import StmEditDocDrawer from "./StmEditDocDrawer";
import {
  addMappingRequest,
  aiScenariosRequest,
  completeDocRequest,
  createManualRequest,
  deleteDocRequest,
  deleteMappingRequest,
  fetchDocsRequest,
  fetchMappingsRequest,
  generateRequest,
  reopenDocRequest,
  runRequest,
  selectDocument,
  updateDocRequest,
  updateMappingRequest,
  uploadRequest,
} from "./stmSlice";

const { Text, Paragraph, Title } = Typography;

type StepKey = 0 | 1 | 2 | 3 | 4;
type AuthorMode = "upload" | "manual" | "ai";
type DocTab = "active" | "completed";

const VALIDATION_TYPES: StmValidationType[] = [
  "ROW_COUNT",
  "NULL_CHECK",
  "DUPLICATE_CHECK",
  "TRANSFORMATION_CHECK",
  "REFERENCE_CHECK",
];

const TYPE_COLOR: Record<StmValidationType, string> = {
  ROW_COUNT: "geekblue",
  NULL_CHECK: "magenta",
  DUPLICATE_CHECK: "volcano",
  TRANSFORMATION_CHECK: "purple",
  REFERENCE_CHECK: "cyan",
};

interface ManualDocFormValues {
  file_name: string;
}

interface MappingFormValues {
  source_table?: string;
  source_column?: string;
  target_table?: string;
  target_column?: string;
  join_key?: string;
  transformation_rule?: string;
  validation_type: StmValidationType;
}

interface AiScenarioFormValues {
  scenario: string;
  target_table?: string;
  source_tables_csv?: string;
  count: number;
  persist: boolean;
}

interface CompleteFormValues {
  notes?: string;
}

/** Compute the "current" step automatically from the selected doc + mappings + run state. */
function computeStep(
  selectedDoc: StmDocument | undefined,
  mappingsCount: number,
  lastRunId: string | null,
): StepKey {
  if (!selectedDoc) return 0;
  if (selectedDoc.is_completed) return 4;
  if (!mappingsCount) return 1;
  if (!lastRunId) return 2;
  return 3;
}

export const StmConverterPage = () => {
  const dispatch = useAppDispatch();
  const project = useAppSelector((s) => s.projects.selected);
  const stm = useAppSelector((s) => s.stm);
  const { message } = App.useApp();

  // ---------------- Local UI state ----------------------------------------
  const [docTab, setDocTab] = useState<DocTab>("active");
  const [step, setStep] = useState<StepKey>(0);
  const [authorMode, setAuthorMode] = useState<AuthorMode>("manual");

  const [createDocOpen, setCreateDocOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [editDocOpen, setEditDocOpen] = useState(false);
  const [mappingDrawer, setMappingDrawer] = useState<{
    open: boolean;
    editing?: StmMapping;
  }>({ open: false });

  const [createDocForm] = Form.useForm<ManualDocFormValues>();
  const [mappingForm] = Form.useForm<MappingFormValues>();
  const [aiForm] = Form.useForm<AiScenarioFormValues>();
  const [completeForm] = Form.useForm<CompleteFormValues>();

  // Data sources for the validation step
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [selectedDataSource, setSelectedDataSource] = useState<string | undefined>();

  // ---------------- Effects -----------------------------------------------
  useEffect(() => {
    if (project?.id) dispatch(fetchDocsRequest(project.id));
  }, [project?.id, dispatch]);

  useEffect(() => {
    if (stm.selectedDocId) dispatch(fetchMappingsRequest(stm.selectedDocId));
  }, [stm.selectedDocId, dispatch]);

  useEffect(() => {
    if (stm.error) message.error(stm.error);
  }, [stm.error, message]);

  useEffect(() => {
    if (stm.lastRunId) message.success(`Validation queued: ${stm.lastRunId}`);
  }, [stm.lastRunId, message]);

  useEffect(() => {
    let cancelled = false;
    if (project?.id) {
      dataSourcesApi
        .list(project.id)
        .then((rows) => {
          if (!cancelled) setDataSources(rows);
        })
        .catch(() => undefined);
    } else {
      setDataSources([]);
    }
    return () => {
      cancelled = true;
    };
  }, [project?.id]);

  // ---------------- Derived state -----------------------------------------
  const selectedDoc: StmDocument | undefined = useMemo(
    () => stm.documents.find((d) => d.id === stm.selectedDocId),
    [stm.documents, stm.selectedDocId],
  );

  const activeDocs = useMemo(
    () => stm.documents.filter((d) => !d.is_completed),
    [stm.documents],
  );
  const completedDocs = useMemo(
    () => stm.documents.filter((d) => d.is_completed),
    [stm.documents],
  );

  // Auto-advance / sync step when the doc changes
  useEffect(() => {
    setStep(computeStep(selectedDoc, stm.mappings.length, stm.lastRunId));
  }, [selectedDoc, stm.mappings.length, stm.lastRunId]);

  // If user moves to completed tab, hide the running banner
  useEffect(() => {
    if (docTab === "completed" && selectedDoc && !selectedDoc.is_completed) {
      dispatch(selectDocument(null));
    }
    if (docTab === "active" && selectedDoc && selectedDoc.is_completed) {
      dispatch(selectDocument(null));
    }
  }, [docTab, selectedDoc, dispatch]);

  // ---------------- Handlers ----------------------------------------------
  const uploadProps: UploadProps = {
    accept: ".xlsx,.xls",
    showUploadList: false,
    beforeUpload: (file) => {
      if (project) {
        dispatch(uploadRequest({ projectId: project.id, file }));
      }
      return false;
    },
  };

  const submitCreateDoc = async () => {
    const values = await createDocForm.validateFields();
    if (!project) return;
    dispatch(createManualRequest({ projectId: project.id, data: values }));
    setCreateDocOpen(false);
    createDocForm.resetFields();
  };

  const openMappingForCreate = useCallback(() => {
    mappingForm.resetFields();
    mappingForm.setFieldsValue({ validation_type: "TRANSFORMATION_CHECK" });
    setMappingDrawer({ open: true });
  }, [mappingForm]);

  const openMappingForEdit = useCallback(
    (mapping: StmMapping) => {
      mappingForm.setFieldsValue({
        source_table: mapping.source_table ?? undefined,
        source_column: mapping.source_column ?? undefined,
        target_table: mapping.target_table ?? undefined,
        target_column: mapping.target_column ?? undefined,
        join_key: mapping.join_key ?? undefined,
        transformation_rule: mapping.transformation_rule ?? undefined,
        validation_type: mapping.validation_type,
      });
      setMappingDrawer({ open: true, editing: mapping });
    },
    [mappingForm],
  );

  const submitMapping = async () => {
    const values = await mappingForm.validateFields();
    if (!stm.selectedDocId) return;
    const payload: StmMappingCreatePayload = {
      source_table: values.source_table || null,
      source_column: values.source_column || null,
      target_table: values.target_table || null,
      target_column: values.target_column || null,
      join_key: values.join_key || null,
      transformation_rule: values.transformation_rule || null,
      validation_type: values.validation_type,
    };
    if (mappingDrawer.editing) {
      dispatch(updateMappingRequest({ mappingId: mappingDrawer.editing.id, data: payload }));
    } else {
      dispatch(addMappingRequest({ documentId: stm.selectedDocId, data: payload }));
    }
    setMappingDrawer({ open: false });
  };

  const submitAiScenarios = async () => {
    const values = await aiForm.validateFields();
    if (!project || !stm.selectedDocId) return;
    const sources = (values.source_tables_csv || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    dispatch(
      aiScenariosRequest({
        projectId: project.id,
        documentId: stm.selectedDocId,
        data: {
          scenario: values.scenario,
          target_table: values.target_table || null,
          source_tables: sources,
          count: values.count,
          persist: values.persist,
        },
      }),
    );
    setAiOpen(false);
  };

  const submitComplete = async () => {
    const values = await completeForm.validateFields();
    if (!stm.selectedDocId) return;
    dispatch(
      completeDocRequest({ documentId: stm.selectedDocId, data: { notes: values.notes ?? null } }),
    );
    setCompleteOpen(false);
    completeForm.resetFields();
    setDocTab("completed");
  };

  // ---------------- Mapping table columns ---------------------------------
  const mappingColumns: ColumnsType<StmMapping> = useMemo(
    () => [
      {
        title: "Source",
        key: "source",
        render: (_, m) => (
          <Text>
            {m.source_table || "—"}
            <Text type="secondary">.</Text>
            {m.source_column || "—"}
          </Text>
        ),
      },
      {
        title: "Target",
        key: "target",
        render: (_, m) => (
          <Text>
            {m.target_table || "—"}
            <Text type="secondary">.</Text>
            {m.target_column || "—"}
          </Text>
        ),
      },
      {
        title: "Transformation",
        dataIndex: "transformation_rule",
        ellipsis: true,
        render: (v: string | null | undefined) => v || <Text type="secondary">—</Text>,
      },
      {
        title: "Type",
        dataIndex: "validation_type",
        width: 180,
        render: (v: StmValidationType) => <Tag color={TYPE_COLOR[v]}>{v}</Tag>,
        filters: VALIDATION_TYPES.map((v) => ({ text: v, value: v })),
        onFilter: (value, record) => record.validation_type === value,
      },
      {
        title: "Actions",
        key: "actions",
        width: 120,
        align: "right",
        render: (_, m) => (
          <Space>
            <Tooltip title="Edit mapping">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => openMappingForEdit(m)}
                disabled={selectedDoc?.is_completed}
                aria-label="Edit mapping"
              />
            </Tooltip>
            <Popconfirm
              title="Delete mapping?"
              okText="Delete"
              okButtonProps={{ danger: true }}
              disabled={selectedDoc?.is_completed}
              onConfirm={() => dispatch(deleteMappingRequest({ mappingId: m.id }))}
            >
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={selectedDoc?.is_completed}
                aria-label="Delete mapping"
              />
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [dispatch, openMappingForEdit, selectedDoc?.is_completed],
  );

  // ---------------- Render -----------------------------------------------
  const visibleDocs = docTab === "active" ? activeDocs : completedDocs;

  return (
    <div>
      <PageHeader
        title="STM Converter"
        subtitle="Author Source-to-Target validations through a guided flow — upload Excel, draft manually or let AI propose scenarios."
        actions={<ProjectPicker />}
      />

      {!project && <SelectProjectHint message="Select a project to author STM scenarios." />}

      <Row gutter={[16, 16]} align="top">
        {/* Left rail: documents list with active/completed tabs */}
        <Col xs={24} md={8} lg={7}>
          <Card
            title={
              <Space size={8}>
                <FolderOpenOutlined />
                <span>STM Documents</span>
              </Space>
            }
            extra={
              <Tooltip title="Create a new manual STM document">
                <Button
                  size="small"
                  type="primary"
                  icon={<FileAddOutlined />}
                  disabled={!project}
                  onClick={() => setCreateDocOpen(true)}
                >
                  New
                </Button>
              </Tooltip>
            }
            styles={{ body: { padding: 0 } }}
          >
            <div style={{ padding: "12px 16px 0" }}>
              <Segmented<DocTab>
                value={docTab}
                onChange={(v) => setDocTab(v)}
                block
                options={[
                  {
                    label: (
                      <Space size={6}>
                        <span>Active</span>
                        <Badge count={activeDocs.length} color={tokens.color.primary} />
                      </Space>
                    ),
                    value: "active",
                  },
                  {
                    label: (
                      <Space size={6}>
                        <HistoryOutlined />
                        <span>Completed</span>
                        <Badge count={completedDocs.length} color="#10b981" />
                      </Space>
                    ),
                    value: "completed",
                  },
                ]}
              />
            </div>
            <div style={{ padding: 12, maxHeight: 560, overflow: "auto" }}>
              {visibleDocs.length === 0 ? (
                <Empty
                  description={
                    docTab === "active"
                      ? "No active STM documents — create one or upload a workbook."
                      : "No completed STM documents yet."
                  }
                  style={{ padding: "24px 8px" }}
                />
              ) : (
                <List
                  dataSource={visibleDocs}
                  loading={stm.loading && stm.documents.length === 0}
                  renderItem={(d: StmDocument) => {
                    const active = d.id === stm.selectedDocId;
                    return (
                      <List.Item
                        style={{
                          cursor: "pointer",
                          background: active
                            ? "rgba(99,102,241,0.10)"
                            : "transparent",
                          borderRadius: 10,
                          padding: "10px 12px",
                          marginBottom: 6,
                          borderLeft: active
                            ? `3px solid ${tokens.color.primary}`
                            : "3px solid transparent",
                          transition: "all 200ms ease",
                          border: "1px solid rgba(148,163,184,0.18)",
                        }}
                        onClick={() => dispatch(selectDocument(d.id))}
                      >
                        <List.Item.Meta
                          title={
                            <Space style={{ width: "100%", justifyContent: "space-between" }}>
                              <Text strong ellipsis={{ tooltip: d.file_name }}>
                                {d.file_name}
                              </Text>
                              {d.is_completed ? (
                                <Tag icon={<CheckCircleOutlined />} color="success">
                                  DONE
                                </Tag>
                              ) : (
                                <Tag color={d.status === "PARSED" ? "processing" : "default"}>
                                  {d.status}
                                </Tag>
                              )}
                            </Space>
                          }
                          description={
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {d.is_completed && d.completed_at
                                ? `Completed ${new Date(d.completed_at).toLocaleString()}`
                                : d.created_at
                                  ? new Date(d.created_at).toLocaleString()
                                  : ""}
                            </Text>
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
              )}
            </div>
          </Card>
        </Col>

        {/* Right pane: stepper-driven flow */}
        <Col xs={24} md={16} lg={17}>
          <Card
            title={
              <Space size={12} align="center" wrap>
                <span>{selectedDoc ? selectedDoc.file_name : "STM Flow"}</span>
                {selectedDoc?.is_completed ? (
                  <Tag icon={<CheckCircleOutlined />} color="success">
                    Completed
                  </Tag>
                ) : selectedDoc ? (
                  <Tag color="processing">In progress</Tag>
                ) : null}
              </Space>
            }
            extra={
              selectedDoc ? (
                <Space>
                  <Tooltip title="Edit name & notes">
                    <Button
                      icon={<EditOutlined />}
                      onClick={() => setEditDocOpen(true)}
                      loading={stm.savingDoc}
                    >
                      Edit
                    </Button>
                  </Tooltip>
                  {selectedDoc.is_completed ? (
                    <Tooltip title="Re-open this document for further edits">
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={() => {
                          dispatch(reopenDocRequest({ documentId: selectedDoc.id }));
                          setDocTab("active");
                        }}
                        loading={stm.savingDoc}
                      >
                        Re-open
                      </Button>
                    </Tooltip>
                  ) : null}
                  <Popconfirm
                    title="Delete this STM document?"
                    description="All mappings and history for it will be removed."
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                    onConfirm={() =>
                      dispatch(deleteDocRequest({ documentId: selectedDoc.id }))
                    }
                  >
                    <Tooltip title="Delete document">
                      <Button danger icon={<DeleteOutlined />} loading={stm.savingDoc}>
                        Delete
                      </Button>
                    </Tooltip>
                  </Popconfirm>
                </Space>
              ) : null
            }
          >
            {!selectedDoc ? (
              <Empty
                description={
                  docTab === "active"
                    ? "Select an active document, upload a workbook, or create a new manual STM to get started."
                    : "Select a completed document to view its mappings or re-open it for edits."
                }
                style={{ padding: 32 }}
              >
                {docTab === "active" ? (
                  <Space wrap>
                    <Upload {...uploadProps}>
                      <Button
                        type="primary"
                        icon={<CloudUploadOutlined />}
                        loading={stm.uploading}
                        disabled={!project}
                      >
                        Upload Excel
                      </Button>
                    </Upload>
                    <Button
                      icon={<FileAddOutlined />}
                      onClick={() => setCreateDocOpen(true)}
                      disabled={!project}
                    >
                      New manual STM
                    </Button>
                  </Space>
                ) : null}
              </Empty>
            ) : (
              <>
                <Steps
                  size="small"
                  current={step}
                  onChange={(c) => setStep(c as StepKey)}
                  items={[
                    {
                      title: "Document",
                      description: "Source workbook or empty doc",
                      icon: <FileAddOutlined />,
                    },
                    {
                      title: "Mappings",
                      description: "Author or generate",
                      icon: <PlusOutlined />,
                    },
                    {
                      title: "Generate SQL",
                      description: "Per validation type",
                      icon: <ThunderboltOutlined />,
                    },
                    {
                      title: "Validate",
                      description: "Run against data source",
                      icon: <PlayCircleOutlined />,
                    },
                    {
                      title: "Complete",
                      description: "Archive to history",
                      icon: <CheckCircleOutlined />,
                    },
                  ]}
                  style={{ marginBottom: 24 }}
                />

                {/* Step bodies */}
                {step === 0 && (
                  <StepDocument
                    doc={selectedDoc}
                    uploading={stm.uploading}
                    uploadProps={uploadProps}
                    onCreateNew={() => setCreateDocOpen(true)}
                    onContinue={() => setStep(1)}
                  />
                )}

                {step === 1 && (
                  <StepMappings
                    mode={authorMode}
                    onModeChange={setAuthorMode}
                    columns={mappingColumns}
                    mappings={stm.mappings}
                    loading={stm.loading && stm.mappings.length === 0}
                    onAddMapping={openMappingForCreate}
                    onAiOpen={() => setAiOpen(true)}
                    aiBusy={stm.generatingAi}
                    aiUsedFallback={stm.lastAiUsedFallback}
                    docId={stm.selectedDocId}
                    onRefresh={() =>
                      stm.selectedDocId && dispatch(fetchMappingsRequest(stm.selectedDocId))
                    }
                    onContinue={() => setStep(2)}
                    locked={Boolean(selectedDoc.is_completed)}
                    uploadProps={uploadProps}
                    uploading={stm.uploading}
                  />
                )}

                {step === 2 && (
                  <StepGenerateSql
                    mappingsCount={stm.mappings.length}
                    busy={stm.generating}
                    locked={Boolean(selectedDoc.is_completed)}
                    onGenerate={() =>
                      project &&
                      stm.selectedDocId &&
                      dispatch(
                        generateRequest({
                          projectId: project.id,
                          documentId: stm.selectedDocId,
                          useAi: true,
                        }),
                      )
                    }
                    onBack={() => setStep(1)}
                    onContinue={() => setStep(3)}
                  />
                )}

                {step === 3 && (
                  <StepValidate
                    dataSources={dataSources}
                    selected={selectedDataSource}
                    onSelect={setSelectedDataSource}
                    busy={stm.running}
                    locked={Boolean(selectedDoc.is_completed)}
                    lastRunId={stm.lastRunId}
                    onRun={() =>
                      stm.selectedDocId &&
                      dispatch(
                        runRequest({
                          documentId: stm.selectedDocId,
                          data_source_id: selectedDataSource,
                        }),
                      )
                    }
                    onBack={() => setStep(2)}
                    onContinue={() => setStep(4)}
                  />
                )}

                {step === 4 && (
                  <StepComplete
                    doc={selectedDoc}
                    mappingCount={stm.mappings.length}
                    lastRunId={stm.lastRunId}
                    onMarkComplete={() => setCompleteOpen(true)}
                    onReopen={() =>
                      dispatch(reopenDocRequest({ documentId: selectedDoc.id }))
                    }
                    busy={stm.savingDoc}
                  />
                )}
              </>
            )}
          </Card>
        </Col>
      </Row>

      {/* New manual document modal */}
      <Modal
        title="New manual STM document"
        open={createDocOpen}
        onCancel={() => setCreateDocOpen(false)}
        onOk={submitCreateDoc}
        okText="Create"
        confirmLoading={stm.creatingDoc}
        destroyOnHidden
      >
        <Paragraph type="secondary" style={{ marginTop: 0 }}>
          Create an empty STM document, then add mappings manually or generate them with AI.
        </Paragraph>
        <Form<ManualDocFormValues> layout="vertical" form={createDocForm}>
          <Form.Item
            name="file_name"
            label="Name"
            rules={[required("Name")]}
            initialValue="Manual STM"
          >
            <Input placeholder="e.g. Customer dim STM" autoFocus />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add / edit mapping drawer */}
      <Drawer
        title={mappingDrawer.editing ? "Edit mapping" : "Add mapping"}
        open={mappingDrawer.open}
        onClose={() => setMappingDrawer({ open: false })}
        width={520}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={() => setMappingDrawer({ open: false })}>Cancel</Button>
            <Button type="primary" loading={stm.savingMapping} onClick={submitMapping}>
              Save
            </Button>
          </Space>
        }
      >
        <Form<MappingFormValues> layout="vertical" form={mappingForm}>
          <FormSection title="Source" description="What we read from.">
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="source_table" label="Table">
                  <Input placeholder="e.g. src_customers" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="source_column" label="Column">
                  <Input placeholder="e.g. customer_id" />
                </Form.Item>
              </Col>
            </Row>
          </FormSection>

          <FormSection title="Target" description="What we validate against.">
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="target_table" label="Table">
                  <Input placeholder="e.g. dim_customer" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="target_column" label="Column">
                  <Input placeholder="e.g. customer_key" />
                </Form.Item>
              </Col>
            </Row>
          </FormSection>

          <FormSection title="Validation" description="How we should compare them.">
            <Form.Item name="join_key" label="Join key">
              <Input placeholder="e.g. customer_id" />
            </Form.Item>
            <Form.Item name="transformation_rule" label="Transformation rule">
              <Input.TextArea rows={3} placeholder="e.g. UPPER(TRIM(name)); amount * fx_rate" />
            </Form.Item>
            <Form.Item
              name="validation_type"
              label="Validation type"
              rules={[required("Validation type")]}
            >
              <Select<StmValidationType>
                options={VALIDATION_TYPES.map((v) => ({ label: v, value: v }))}
              />
            </Form.Item>
          </FormSection>
        </Form>
      </Drawer>

      {/* AI scenarios modal */}
      <Modal
        title={
          <Space>
            <RobotOutlined />
            Generate STM scenarios with AI
          </Space>
        }
        open={aiOpen}
        onCancel={() => setAiOpen(false)}
        onOk={submitAiScenarios}
        okText="Generate"
        confirmLoading={stm.generatingAi}
        width={620}
        destroyOnHidden
      >
        <Paragraph type="secondary" style={{ marginTop: 0 }}>
          Describe the data you want validated. The AI will draft up to{" "}
          <Text strong>n</Text> source-to-target mappings covering row counts, null checks,
          duplicates, transformations and referential integrity.
        </Paragraph>
        <Form<AiScenarioFormValues>
          layout="vertical"
          form={aiForm}
          initialValues={{ count: 6, persist: true }}
        >
          <Form.Item
            name="scenario"
            label="Scenario"
            rules={[required("Scenario"), { min: 10, message: "Add a bit more detail." }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="e.g. Validate the customer dimension load: id is unique, country_code is referential, amount_usd is amount * fx_rate"
              autoFocus
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="target_table" label="Target table (optional)">
                <Input placeholder="e.g. dim_customer" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="source_tables_csv" label="Source tables (comma-separated)">
                <Input placeholder="e.g. src_customers, ref_country" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="count" label="Mappings to draft">
                <InputNumber min={1} max={20} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="persist" label="Save to document" valuePropName="checked">
                <Select
                  options={[
                    { label: "Save to document", value: true },
                    { label: "Preview only (don't save)", value: false },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Mark complete modal */}
      <Modal
        title="Mark STM as complete"
        open={completeOpen}
        onCancel={() => setCompleteOpen(false)}
        onOk={submitComplete}
        okText="Mark complete"
        confirmLoading={stm.savingDoc}
        destroyOnHidden
      >
        <Paragraph type="secondary" style={{ marginTop: 0 }}>
          Move this STM document to the <Text strong>Completed</Text> tab. You can re-open
          it any time.
        </Paragraph>
        <Form<CompleteFormValues> layout="vertical" form={completeForm}>
          <Form.Item name="notes" label="Closing notes (optional)">
            <Input.TextArea
              rows={4}
              placeholder="e.g. Validated against PROD on 2026-04-25; passed 38/38 checks."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit doc drawer */}
      <StmEditDocDrawer
        open={editDocOpen}
        saving={stm.savingDoc}
        document={selectedDoc}
        onClose={() => setEditDocOpen(false)}
        onSubmit={(values) => {
          if (!selectedDoc) return;
          dispatch(
            updateDocRequest({
              documentId: selectedDoc.id,
              data: { file_name: values.file_name, notes: values.notes ?? null },
            }),
          );
          setEditDocOpen(false);
        }}
      />
    </div>
  );
};

// ----------------------------------------------------------------------------
// Step bodies — small, focused presentational components
// ----------------------------------------------------------------------------

interface StepDocumentProps {
  doc: StmDocument;
  uploading: boolean;
  uploadProps: UploadProps;
  onCreateNew: () => void;
  onContinue: () => void;
}

const StepDocument = ({ doc, uploading, uploadProps, onCreateNew, onContinue }: StepDocumentProps) => (
  <Card
    type="inner"
    title="1. Document"
    extra={
      <Space>
        <Upload {...uploadProps}>
          <Button icon={<CloudUploadOutlined />} loading={uploading}>
            Upload another
          </Button>
        </Upload>
        <Button icon={<FileAddOutlined />} onClick={onCreateNew}>
          New manual
        </Button>
      </Space>
    }
  >
    <Row gutter={[16, 8]}>
      <Col span={24}>
        <Title level={5} style={{ marginTop: 0 }}>
          {doc.file_name}
        </Title>
        <Space wrap>
          <Tag color={doc.status === "PARSED" ? "processing" : "default"}>{doc.status}</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Created {doc.created_at ? new Date(doc.created_at).toLocaleString() : "—"}
          </Text>
        </Space>
      </Col>
      {doc.notes ? (
        <Col span={24}>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {doc.notes}
          </Paragraph>
        </Col>
      ) : null}
    </Row>
    <Space style={{ marginTop: 16 }}>
      <Button type="primary" onClick={onContinue}>
        Continue to mappings
      </Button>
    </Space>
  </Card>
);

interface StepMappingsProps {
  mode: AuthorMode;
  onModeChange: (m: AuthorMode) => void;
  columns: ColumnsType<StmMapping>;
  mappings: StmMapping[];
  loading: boolean;
  onAddMapping: () => void;
  onAiOpen: () => void;
  aiBusy: boolean;
  aiUsedFallback: boolean;
  docId: string | null;
  onRefresh: () => void;
  onContinue: () => void;
  locked: boolean;
  uploadProps: UploadProps;
  uploading: boolean;
}

const StepMappings = ({
  mode,
  onModeChange,
  columns,
  mappings,
  loading,
  onAddMapping,
  onAiOpen,
  aiBusy,
  aiUsedFallback,
  onRefresh,
  onContinue,
  locked,
  uploadProps,
  uploading,
}: StepMappingsProps) => (
  <Card
    type="inner"
    title="2. Mappings"
    extra={
      !locked ? (
        <Segmented<AuthorMode>
          value={mode}
          onChange={(v) => onModeChange(v)}
          options={[
            { label: "Manual", value: "manual", icon: <PlusOutlined /> },
            { label: "AI Scenarios", value: "ai", icon: <RobotOutlined /> },
            { label: "Upload Excel", value: "upload", icon: <CloudUploadOutlined /> },
          ]}
        />
      ) : (
        <Tag color="success">Locked — completed</Tag>
      )
    }
  >
    {!locked && mode === "manual" && (
      <Banner
        title="Manual mapping"
        description="Build mappings row-by-row, perfect for STM flows that need careful curation."
        action={
          <Button type="primary" icon={<PlusOutlined />} onClick={onAddMapping}>
            Add mapping
          </Button>
        }
      />
    )}
    {!locked && mode === "ai" && (
      <Banner
        title="AI scenarios"
        description="Describe the data flow — AI drafts row counts, null checks, dupes, transformations and referential checks."
        action={
          <Button type="primary" icon={<RobotOutlined />} onClick={onAiOpen} loading={aiBusy}>
            Generate scenarios
          </Button>
        }
      />
    )}
    {!locked && mode === "upload" && (
      <Banner
        title="Upload Excel"
        description="Drop an .xlsx workbook with one row per source-to-target mapping."
        action={
          <Upload {...uploadProps}>
            <Button type="primary" icon={<CloudUploadOutlined />} loading={uploading}>
              Choose file
            </Button>
          </Upload>
        }
      />
    )}

    {aiUsedFallback ? (
      <Paragraph type="warning" style={{ marginTop: 0 }}>
        AI provider unavailable — using built-in heuristic scenarios. Edit any row to refine.
      </Paragraph>
    ) : null}

    <DataTable<StmMapping>
      data={mappings}
      columns={columns}
      rowKey="id"
      size="small"
      searchable
      searchPlaceholder="Search mappings…"
      onRefresh={onRefresh}
      loading={loading}
      emptyDescription="No mappings yet — add a manual row, generate scenarios with AI, or upload a workbook."
      pagination={{ pageSize: 10, showSizeChanger: true }}
    />

    <Space style={{ marginTop: 16 }}>
      <Button type="primary" onClick={onContinue} disabled={mappings.length === 0}>
        Continue to SQL generation
      </Button>
      <Text type="secondary">{mappings.length} mapping(s) staged.</Text>
    </Space>
  </Card>
);

interface StepGenerateSqlProps {
  mappingsCount: number;
  busy: boolean;
  locked: boolean;
  onGenerate: () => void;
  onBack: () => void;
  onContinue: () => void;
}

const StepGenerateSql = ({
  mappingsCount,
  busy,
  locked,
  onGenerate,
  onBack,
  onContinue,
}: StepGenerateSqlProps) => (
  <Card
    type="inner"
    title="3. Generate SQL"
    extra={
      <Tooltip title="Use AI when available, fall back to safe templates.">
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          loading={busy}
          disabled={mappingsCount === 0 || locked}
          onClick={onGenerate}
        >
          Generate SQL
        </Button>
      </Tooltip>
    }
  >
    <Paragraph>
      Generate validation SQL for all {mappingsCount} mapping(s). The system uses AI where
      it has high confidence, and falls back to deterministic templates for the rest, so
      you always end up with executable SQL.
    </Paragraph>
    <Space>
      <Button onClick={onBack}>Back</Button>
      <Button type="primary" onClick={onContinue}>
        Continue to validation
      </Button>
    </Space>
  </Card>
);

interface StepValidateProps {
  dataSources: DataSource[];
  selected?: string;
  onSelect: (id?: string) => void;
  busy: boolean;
  locked: boolean;
  lastRunId: string | null;
  onRun: () => void;
  onBack: () => void;
  onContinue: () => void;
}

const StepValidate = ({
  dataSources,
  selected,
  onSelect,
  busy,
  locked,
  lastRunId,
  onRun,
  onBack,
  onContinue,
}: StepValidateProps) => (
  <Card type="inner" title="4. Validate">
    <Paragraph type="secondary" style={{ marginTop: 0 }}>
      Pick a data source connection — the validation runs are queued via Celery and
      streamed to the Reports page.
    </Paragraph>
    <Row gutter={[12, 12]}>
      <Col xs={24} md={14}>
        <Select
          allowClear
          showSearch
          placeholder="Select a data source (optional — uses default if blank)"
          style={{ width: "100%" }}
          value={selected}
          onChange={(v) => onSelect(v)}
          optionFilterProp="label"
          options={dataSources.map((ds) => ({
            value: ds.id,
            label: `${ds.name} — ${ds.source_type}${ds.is_active ? "" : " (inactive)"}`,
            disabled: !ds.is_active,
          }))}
        />
      </Col>
      <Col xs={24} md={10}>
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={busy}
          disabled={locked}
          onClick={onRun}
          block
        >
          Run validation
        </Button>
      </Col>
    </Row>
    {lastRunId ? (
      <Paragraph style={{ marginTop: 16 }}>
        <Tag color="processing">Run ID</Tag>
        <Text code copyable={{ text: lastRunId }}>
          {lastRunId}
        </Text>{" "}
        — track progress on the <b>Reports</b> page.
      </Paragraph>
    ) : null}
    <Space style={{ marginTop: 16 }}>
      <Button onClick={onBack}>Back</Button>
      <Button type="primary" onClick={onContinue}>
        Continue to complete
      </Button>
    </Space>
  </Card>
);

interface StepCompleteProps {
  doc: StmDocument;
  mappingCount: number;
  lastRunId: string | null;
  onMarkComplete: () => void;
  onReopen: () => void;
  busy: boolean;
}

const StepComplete = ({
  doc,
  mappingCount,
  lastRunId,
  onMarkComplete,
  onReopen,
  busy,
}: StepCompleteProps) => (
  <Card
    type="inner"
    title="5. Complete"
    extra={
      doc.is_completed ? (
        <Button icon={<ReloadOutlined />} onClick={onReopen} loading={busy}>
          Re-open
        </Button>
      ) : (
        <Button type="primary" icon={<CheckCircleOutlined />} onClick={onMarkComplete} loading={busy}>
          Mark complete
        </Button>
      )
    }
  >
    <Row gutter={[16, 16]}>
      <Col xs={24} md={8}>
        <SummaryStat label="Status" value={doc.is_completed ? "Completed" : "In progress"} />
      </Col>
      <Col xs={24} md={8}>
        <SummaryStat label="Mappings" value={String(mappingCount)} />
      </Col>
      <Col xs={24} md={8}>
        <SummaryStat label="Last run" value={lastRunId ?? "—"} mono />
      </Col>
    </Row>
    {doc.notes ? (
      <Paragraph type="secondary" style={{ marginTop: 16 }}>
        <Text strong>Notes: </Text>
        {doc.notes}
      </Paragraph>
    ) : null}
    {doc.is_completed ? (
      <Paragraph type="success" style={{ marginTop: 16, marginBottom: 0 }}>
        <CheckCircleOutlined /> This STM is archived to the Completed tab. Re-open it any
        time to continue editing.
      </Paragraph>
    ) : (
      <Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>
        Mark this STM complete to lock edits and archive it for audit. You can always re-open it later.
      </Paragraph>
    )}
  </Card>
);

interface BannerProps {
  title: string;
  description: string;
  action: ReactNode;
}

const Banner = ({ title, description, action }: BannerProps) => (
  <div
    style={{
      background: "rgba(99,102,241,0.06)",
      border: "1px dashed rgba(99,102,241,0.35)",
      borderRadius: 12,
      padding: "12px 16px",
      marginBottom: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    }}
  >
    <Space direction="vertical" size={0}>
      <Text strong>{title}</Text>
      <Text type="secondary">{description}</Text>
    </Space>
    {action}
  </div>
);

interface SummaryStatProps {
  label: string;
  value: string;
  mono?: boolean;
}

const SummaryStat = ({ label, value, mono }: SummaryStatProps) => (
  <div
    style={{
      borderRadius: 12,
      padding: "12px 16px",
      background: "rgba(148,163,184,0.08)",
      border: "1px solid rgba(148,163,184,0.18)",
    }}
  >
    <Text type="secondary" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>
      {label}
    </Text>
    <div
      style={{
        marginTop: 4,
        fontSize: 18,
        fontWeight: 600,
        fontFamily: mono
          ? "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
          : undefined,
      }}
    >
      {value}
    </div>
  </div>
);

export default StmConverterPage;
