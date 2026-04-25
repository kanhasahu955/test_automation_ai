import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ExecutionResult, ExecutionRun } from "@services/executionApi";

export interface ExecutionsState {
  runs: ExecutionRun[];
  loading: boolean;
  reportLoading: boolean;
  selectedRunId: string | null;
  report: { run: ExecutionRun; results: ExecutionResult[] } | null;
  error?: string;
}

const initialState: ExecutionsState = {
  runs: [],
  loading: false,
  reportLoading: false,
  selectedRunId: null,
  report: null,
};

const slice = createSlice({
  name: "executions",
  initialState,
  reducers: {
    fetchRunsRequest: {
      reducer(state) {
        state.loading = true;
      },
      prepare(projectId: string) {
        return { payload: { projectId } };
      },
    },
    fetchRunsSuccess(state, action: PayloadAction<ExecutionRun[]>) {
      state.loading = false;
      state.runs = action.payload;
    },
    selectRun(state, action: PayloadAction<string | null>) {
      state.selectedRunId = action.payload;
      state.report = null;
    },
    fetchReportRequest: {
      reducer(state) {
        state.reportLoading = true;
      },
      prepare(runId: string) {
        return { payload: runId };
      },
    },
    fetchReportSuccess(
      state,
      action: PayloadAction<{ run: ExecutionRun; results: ExecutionResult[] }>,
    ) {
      state.reportLoading = false;
      state.report = action.payload;
    },
  },
});

export const {
  fetchRunsRequest,
  fetchRunsSuccess,
  selectRun,
  fetchReportRequest,
  fetchReportSuccess,
} = slice.actions;
export default slice.reducer;
