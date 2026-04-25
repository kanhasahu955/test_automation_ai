import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type {
  StmAiScenariosPayload,
  StmDocument,
  StmDocumentCompletePayload,
  StmDocumentUpdatePayload,
  StmManualDocPayload,
  StmMapping,
  StmMappingCreatePayload,
  StmMappingUpdatePayload,
} from "@services/stmApi";

export interface StmState {
  documents: StmDocument[];
  mappings: StmMapping[];
  selectedDocId: string | null;
  loading: boolean;
  uploading: boolean;
  creatingDoc: boolean;
  generating: boolean;
  generatingAi: boolean;
  running: boolean;
  savingMapping: boolean;
  savingDoc: boolean;
  lastRunId: string | null;
  lastAiUsedFallback: boolean;
  error?: string;
}

const initialState: StmState = {
  documents: [],
  mappings: [],
  selectedDocId: null,
  loading: false,
  uploading: false,
  creatingDoc: false,
  generating: false,
  generatingAi: false,
  running: false,
  savingMapping: false,
  savingDoc: false,
  lastRunId: null,
  lastAiUsedFallback: false,
};

const slice = createSlice({
  name: "stm",
  initialState,
  reducers: {
    fetchDocsRequest: {
      reducer(state) {
        state.loading = true;
      },
      prepare(projectId: string) {
        return { payload: { projectId } };
      },
    },
    fetchDocsSuccess(state, action: PayloadAction<StmDocument[]>) {
      state.loading = false;
      state.documents = action.payload;
    },
    fetchMappingsRequest: {
      reducer(state) {
        state.loading = true;
      },
      prepare(documentId: string) {
        return { payload: documentId };
      },
    },
    fetchMappingsSuccess(state, action: PayloadAction<StmMapping[]>) {
      state.loading = false;
      state.mappings = action.payload;
    },
    selectDocument(state, action: PayloadAction<string | null>) {
      state.selectedDocId = action.payload;
      state.mappings = [];
    },
    uploadRequest: {
      reducer(state) {
        state.uploading = true;
      },
      prepare(payload: { projectId: string; file: File }) {
        return { payload };
      },
    },
    uploadSuccess(state, action: PayloadAction<StmDocument>) {
      state.uploading = false;
      state.documents = [action.payload, ...state.documents];
      state.selectedDocId = action.payload.id;
    },
    uploadFailure(state, action: PayloadAction<string>) {
      state.uploading = false;
      state.error = action.payload;
    },
    createManualRequest: {
      reducer(state) {
        state.creatingDoc = true;
      },
      prepare(payload: { projectId: string; data: StmManualDocPayload }) {
        return { payload };
      },
    },
    createManualSuccess(state, action: PayloadAction<StmDocument>) {
      state.creatingDoc = false;
      state.documents = [action.payload, ...state.documents];
      state.selectedDocId = action.payload.id;
    },
    createManualFailure(state, action: PayloadAction<string>) {
      state.creatingDoc = false;
      state.error = action.payload;
    },
    addMappingRequest: {
      reducer(state) {
        state.savingMapping = true;
      },
      prepare(payload: { documentId: string; data: StmMappingCreatePayload }) {
        return { payload };
      },
    },
    addMappingSuccess(state, action: PayloadAction<StmMapping>) {
      state.savingMapping = false;
      state.mappings = [...state.mappings, action.payload];
    },
    updateMappingRequest: {
      reducer(state) {
        state.savingMapping = true;
      },
      prepare(payload: { mappingId: string; data: StmMappingUpdatePayload }) {
        return { payload };
      },
    },
    updateMappingSuccess(state, action: PayloadAction<StmMapping>) {
      state.savingMapping = false;
      state.mappings = state.mappings.map((m) =>
        m.id === action.payload.id ? action.payload : m,
      );
    },
    deleteMappingRequest: {
      reducer(state) {
        state.savingMapping = true;
      },
      prepare(payload: { mappingId: string }) {
        return { payload };
      },
    },
    deleteMappingSuccess(state, action: PayloadAction<string>) {
      state.savingMapping = false;
      state.mappings = state.mappings.filter((m) => m.id !== action.payload);
    },
    mappingFailure(state, action: PayloadAction<string>) {
      state.savingMapping = false;
      state.error = action.payload;
    },
    generateRequest: {
      reducer(state) {
        state.generating = true;
      },
      prepare(payload: { projectId: string; documentId: string; useAi?: boolean }) {
        return { payload };
      },
    },
    generateSuccess(state) {
      state.generating = false;
    },
    aiScenariosRequest: {
      reducer(state) {
        state.generatingAi = true;
      },
      prepare(payload: {
        projectId: string;
        documentId: string;
        data: StmAiScenariosPayload;
      }) {
        return { payload };
      },
    },
    aiScenariosSuccess(
      state,
      action: PayloadAction<{ mappings: StmMapping[]; usedFallback: boolean }>,
    ) {
      state.generatingAi = false;
      state.lastAiUsedFallback = action.payload.usedFallback;
      const newOnes = action.payload.mappings.filter(
        (m) => !state.mappings.some((existing) => existing.id === m.id),
      );
      state.mappings = [...state.mappings, ...newOnes];
    },
    aiScenariosFailure(state, action: PayloadAction<string>) {
      state.generatingAi = false;
      state.error = action.payload;
    },
    runRequest: {
      reducer(state) {
        state.running = true;
        state.lastRunId = null;
      },
      prepare(payload: { documentId: string; data_source_id?: string }) {
        return { payload };
      },
    },
    runSuccess(state, action: PayloadAction<string>) {
      state.running = false;
      state.lastRunId = action.payload;
    },
    runFailure(state, action: PayloadAction<string>) {
      state.running = false;
      state.error = action.payload;
    },
    updateDocRequest: {
      reducer(state) {
        state.savingDoc = true;
      },
      prepare(payload: { documentId: string; data: StmDocumentUpdatePayload }) {
        return { payload };
      },
    },
    completeDocRequest: {
      reducer(state) {
        state.savingDoc = true;
      },
      prepare(payload: { documentId: string; data?: StmDocumentCompletePayload }) {
        return { payload };
      },
    },
    reopenDocRequest: {
      reducer(state) {
        state.savingDoc = true;
      },
      prepare(payload: { documentId: string }) {
        return { payload };
      },
    },
    docMutationSuccess(state, action: PayloadAction<StmDocument>) {
      state.savingDoc = false;
      state.documents = state.documents.map((d) =>
        d.id === action.payload.id ? action.payload : d,
      );
    },
    deleteDocRequest: {
      reducer(state) {
        state.savingDoc = true;
      },
      prepare(payload: { documentId: string }) {
        return { payload };
      },
    },
    deleteDocSuccess(state, action: PayloadAction<string>) {
      state.savingDoc = false;
      state.documents = state.documents.filter((d) => d.id !== action.payload);
      if (state.selectedDocId === action.payload) {
        state.selectedDocId = null;
        state.mappings = [];
      }
    },
    docFailure(state, action: PayloadAction<string>) {
      state.savingDoc = false;
      state.error = action.payload;
    },
    clearError(state) {
      state.error = undefined;
    },
  },
});

export const {
  fetchDocsRequest,
  fetchDocsSuccess,
  fetchMappingsRequest,
  fetchMappingsSuccess,
  selectDocument,
  uploadRequest,
  uploadSuccess,
  uploadFailure,
  createManualRequest,
  createManualSuccess,
  createManualFailure,
  addMappingRequest,
  addMappingSuccess,
  updateMappingRequest,
  updateMappingSuccess,
  deleteMappingRequest,
  deleteMappingSuccess,
  mappingFailure,
  generateRequest,
  generateSuccess,
  aiScenariosRequest,
  aiScenariosSuccess,
  aiScenariosFailure,
  runRequest,
  runSuccess,
  runFailure,
  updateDocRequest,
  completeDocRequest,
  reopenDocRequest,
  docMutationSuccess,
  deleteDocRequest,
  deleteDocSuccess,
  docFailure,
  clearError,
} = slice.actions;
export default slice.reducer;
