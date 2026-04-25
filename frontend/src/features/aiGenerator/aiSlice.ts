import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { GeneratedTestCase } from "@services/aiApi";

export type FailureAnalysis = {
  summary: string;
  likely_root_cause: string;
  suggested_fix: string;
  is_flaky: boolean;
};

export interface AiState {
  loading: boolean;
  generatedTestCases: GeneratedTestCase[];
  generatedFlow: Record<string, unknown> | null;
  failureAnalysis: FailureAnalysis | null;
  edgeCases: string[];
  generatedSql: string;
  error?: string;
}

const initialState: AiState = {
  loading: false,
  generatedTestCases: [],
  generatedFlow: null,
  failureAnalysis: null,
  edgeCases: [],
  generatedSql: "",
};

const slice = createSlice({
  name: "ai",
  initialState,
  reducers: {
    generateTestCasesRequest: {
      reducer(state) {
        state.loading = true;
        state.error = undefined;
      },
      prepare(payload: { requirement: string; count?: number }) {
        return { payload };
      },
    },
    generateTestCasesSuccess(state, action: PayloadAction<GeneratedTestCase[]>) {
      state.loading = false;
      state.generatedTestCases = action.payload;
    },
    generateFlowRequest: {
      reducer(state) {
        state.loading = true;
      },
      prepare(payload: { scenario: string }) {
        return { payload };
      },
    },
    generateFlowSuccess(state, action: PayloadAction<Record<string, unknown>>) {
      state.loading = false;
      state.generatedFlow = action.payload;
    },
    analyzeFailureRequest: {
      reducer(state) {
        state.loading = true;
      },
      prepare(payload: { test_name: string; error_message: string; logs?: string }) {
        return { payload };
      },
    },
    analyzeFailureSuccess(state, action: PayloadAction<FailureAnalysis>) {
      state.loading = false;
      state.failureAnalysis = action.payload;
    },
    edgeCasesRequest: {
      reducer(state) {
        state.loading = true;
      },
      prepare(payload: { requirement: string }) {
        return { payload };
      },
    },
    edgeCasesSuccess(state, action: PayloadAction<string[]>) {
      state.loading = false;
      state.edgeCases = action.payload;
    },
    aiFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    resetAi(state) {
      state.generatedTestCases = [];
      state.generatedFlow = null;
      state.failureAnalysis = null;
      state.edgeCases = [];
      state.generatedSql = "";
      state.error = undefined;
    },
  },
});

export const {
  generateTestCasesRequest,
  generateTestCasesSuccess,
  generateFlowRequest,
  generateFlowSuccess,
  analyzeFailureRequest,
  analyzeFailureSuccess,
  edgeCasesRequest,
  edgeCasesSuccess,
  aiFailure,
  resetAi,
} = slice.actions;
export default slice.reducer;
