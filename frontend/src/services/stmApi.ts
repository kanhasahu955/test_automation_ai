import { BaseApiClient } from "./BaseApiClient";

export type StmDocument = {
  id: string;
  project_id: string;
  file_name: string;
  status: "UPLOADED" | "PARSED" | "FAILED";
  notes?: string | null;
  is_completed?: boolean;
  completed_at?: string | null;
  created_at?: string;
};

export type StmDocumentUpdatePayload = {
  file_name?: string;
  notes?: string | null;
};

export type StmDocumentCompletePayload = {
  notes?: string | null;
};

export type StmValidationType =
  | "ROW_COUNT"
  | "NULL_CHECK"
  | "DUPLICATE_CHECK"
  | "TRANSFORMATION_CHECK"
  | "REFERENCE_CHECK";

export type StmMapping = {
  id: string;
  stm_document_id?: string;
  source_table?: string | null;
  source_column?: string | null;
  target_table?: string | null;
  target_column?: string | null;
  join_key?: string | null;
  transformation_rule?: string | null;
  validation_type: StmValidationType;
  mapping_json?: Record<string, unknown> | null;
  created_at?: string;
};

export type StmValidationPayload = {
  data_source_id?: string;
  allow_destructive?: boolean;
};

export type StmManualDocPayload = { file_name: string };

export type StmMappingCreatePayload = {
  source_table?: string | null;
  source_column?: string | null;
  target_table?: string | null;
  target_column?: string | null;
  join_key?: string | null;
  transformation_rule?: string | null;
  validation_type?: StmValidationType;
};

export type StmMappingUpdatePayload = StmMappingCreatePayload;

export type StmAiScenariosPayload = {
  scenario: string;
  target_table?: string | null;
  source_tables?: string[];
  count?: number;
  persist?: boolean;
};

export type StmAiScenariosResponse = {
  mappings: StmMapping[];
  used_fallback: boolean;
};

/** Domain client for STM endpoints (Excel + manual + AI). */
export class StmApiClient extends BaseApiClient {
  upload(projectId: string, file: File): Promise<StmDocument> {
    const fd = new FormData();
    fd.append("file", file);
    return this.post<StmDocument, FormData>(`/projects/${projectId}/stm/upload`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  }

  createManual(projectId: string, payload: StmManualDocPayload): Promise<StmDocument> {
    return this.post<StmDocument, StmManualDocPayload>(
      `/projects/${projectId}/stm/manual`,
      payload,
    );
  }

  listDocuments(projectId: string): Promise<StmDocument[]> {
    return this.get<StmDocument[]>(`/projects/${projectId}/stm/documents`);
  }

  listMappings(documentId: string): Promise<StmMapping[]> {
    return this.get<StmMapping[]>(`/stm/${documentId}/mappings`);
  }

  addMapping(documentId: string, payload: StmMappingCreatePayload): Promise<StmMapping> {
    return this.post<StmMapping, StmMappingCreatePayload>(
      `/stm/${documentId}/mappings`,
      payload,
    );
  }

  updateMapping(mappingId: string, payload: StmMappingUpdatePayload): Promise<StmMapping> {
    return this.patch<StmMapping, StmMappingUpdatePayload>(
      `/stm/mappings/${mappingId}`,
      payload,
    );
  }

  deleteMapping(mappingId: string): Promise<void> {
    return this.delete<void>(`/stm/mappings/${mappingId}`);
  }

  generateSql(projectId: string, documentId: string, useAi = true): Promise<unknown> {
    return this.post<unknown>(`/projects/${projectId}/stm/${documentId}/generate-sql`, {
      use_ai: useAi,
    });
  }

  generateAiScenarios(
    projectId: string,
    documentId: string,
    payload: StmAiScenariosPayload,
  ): Promise<StmAiScenariosResponse> {
    return this.post<StmAiScenariosResponse, StmAiScenariosPayload>(
      `/projects/${projectId}/stm/${documentId}/ai-scenarios`,
      payload,
    );
  }

  runValidation(documentId: string, payload: StmValidationPayload): Promise<unknown> {
    return this.post<unknown, StmValidationPayload>(`/stm/${documentId}/run-validation`, payload);
  }

  updateDocument(
    documentId: string,
    payload: StmDocumentUpdatePayload,
  ): Promise<StmDocument> {
    return this.patch<StmDocument, StmDocumentUpdatePayload>(
      `/stm/documents/${documentId}`,
      payload,
    );
  }

  completeDocument(
    documentId: string,
    payload: StmDocumentCompletePayload = {},
  ): Promise<StmDocument> {
    return this.post<StmDocument, StmDocumentCompletePayload>(
      `/stm/documents/${documentId}/complete`,
      payload,
    );
  }

  reopenDocument(documentId: string): Promise<StmDocument> {
    return this.post<StmDocument>(`/stm/documents/${documentId}/reopen`);
  }

  deleteDocument(documentId: string): Promise<void> {
    return this.delete<void>(`/stm/documents/${documentId}`);
  }
}

const client = new StmApiClient();

export const stmApi = {
  upload: (projectId: string, file: File) => client.upload(projectId, file),
  createManual: (projectId: string, payload: StmManualDocPayload) =>
    client.createManual(projectId, payload),
  listDocuments: (projectId: string) => client.listDocuments(projectId),
  listMappings: (documentId: string) => client.listMappings(documentId),
  addMapping: (documentId: string, payload: StmMappingCreatePayload) =>
    client.addMapping(documentId, payload),
  updateMapping: (mappingId: string, payload: StmMappingUpdatePayload) =>
    client.updateMapping(mappingId, payload),
  deleteMapping: (mappingId: string) => client.deleteMapping(mappingId),
  generateSql: (projectId: string, documentId: string, useAi = true) =>
    client.generateSql(projectId, documentId, useAi),
  generateAiScenarios: (
    projectId: string,
    documentId: string,
    payload: StmAiScenariosPayload,
  ) => client.generateAiScenarios(projectId, documentId, payload),
  runValidation: (documentId: string, payload: StmValidationPayload) =>
    client.runValidation(documentId, payload),
  updateDocument: (documentId: string, payload: StmDocumentUpdatePayload) =>
    client.updateDocument(documentId, payload),
  completeDocument: (documentId: string, payload: StmDocumentCompletePayload = {}) =>
    client.completeDocument(documentId, payload),
  reopenDocument: (documentId: string) => client.reopenDocument(documentId),
  deleteDocument: (documentId: string) => client.deleteDocument(documentId),
};
