import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AiStatus, GeneratedTestCase } from "@services/aiApi";

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
  /**
   * `true` when the LAST successful response came back from the deterministic
   * template fallback (i.e. the LLM is not configured or its parse failed).
   * Reset to `false` on every new request and on `resetAi`.
   */
  usedFallback: boolean;
  status: AiStatus | null;
  error?: string;
}

const initialState: AiState = {
  loading: false,
  generatedTestCases: [],
  generatedFlow: null,
  failureAnalysis: null,
  edgeCases: [],
  generatedSql: "",
  usedFallback: false,
  status: null,
};

const slice = createSlice({
  name: "ai",
  initialState,
  reducers: {
    fetchAiStatusRequest(state) {
      state.error = undefined;
    },
    fetchAiStatusSuccess(state, action: PayloadAction<AiStatus>) {
      state.status = action.payload;
    },
    generateTestCasesRequest: {
      reducer(state) {
        state.loading = true;
        state.error = undefined;
        state.usedFallback = false;
      },
      prepare(payload: { requirement: string; count?: number }) {
        return { payload };
      },
    },
    generateTestCasesSuccess(
      state,
      action: PayloadAction<{ items: GeneratedTestCase[]; usedFallback: boolean }>,
    ) {
      state.loading = false;
      state.generatedTestCases = action.payload.items;
      state.usedFallback = action.payload.usedFallback;
    },
    generateFlowRequest: {
      reducer(state) {
        state.loading = true;
        state.error = undefined;
        state.usedFallback = false;
      },
      prepare(payload: { scenario: string }) {
        return { payload };
      },
    },
    generateFlowSuccess(
      state,
      action: PayloadAction<{ flow: Record<string, unknown>; usedFallback: boolean }>,
    ) {
      state.loading = false;
      state.generatedFlow = action.payload.flow;
      state.usedFallback = action.payload.usedFallback;
    },
    analyzeFailureRequest: {
      reducer(state) {
        state.loading = true;
        state.error = undefined;
        state.usedFallback = false;
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
        state.error = undefined;
        state.usedFallback = false;
      },
      prepare(payload: { requirement: string }) {
        return { payload };
      },
    },
    edgeCasesSuccess(
      state,
      action: PayloadAction<{ edgeCases: string[]; usedFallback: boolean }>,
    ) {
      state.loading = false;
      state.edgeCases = action.payload.edgeCases;
      state.usedFallback = action.payload.usedFallback;
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
      state.usedFallback = false;
      state.error = undefined;
    },
  },
});

export const {
  fetchAiStatusRequest,
  fetchAiStatusSuccess,
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
