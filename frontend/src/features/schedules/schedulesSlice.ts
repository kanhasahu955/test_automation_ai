import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { ExecutionRun } from "@services/executionApi";
import type {
  Schedule,
  ScheduleCreateInput,
  ScheduleListFilters,
  ScheduleUpdateInput,
} from "@services/scheduleApi";

export interface SchedulesState {
  items: Schedule[];
  loading: boolean;
  saving: boolean;
  current: Schedule | null;
  history: ExecutionRun[];
  historyLoading: boolean;
  filters: ScheduleListFilters;
  error?: string;
}

const initialState: SchedulesState = {
  items: [],
  loading: false,
  saving: false,
  current: null,
  history: [],
  historyLoading: false,
  filters: {},
};

const slice = createSlice({
  name: "schedules",
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<ScheduleListFilters>) {
      state.filters = action.payload;
    },

    fetchListRequest: {
      reducer(state) {
        state.loading = true;
        state.error = undefined;
      },
      prepare(payload: { projectId: string; filters?: ScheduleListFilters }) {
        return { payload };
      },
    },
    fetchListSuccess(state, action: PayloadAction<Schedule[]>) {
      state.loading = false;
      state.items = action.payload;
    },
    fetchListFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    fetchOneRequest: {
      reducer(state) {
        state.loading = true;
      },
      prepare(id: string) {
        return { payload: id };
      },
    },
    fetchOneSuccess(state, action: PayloadAction<Schedule>) {
      state.loading = false;
      state.current = action.payload;
    },
    fetchOneFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    createRequest: {
      reducer(state) {
        state.saving = true;
        state.error = undefined;
      },
      prepare(payload: { projectId: string; data: ScheduleCreateInput }) {
        return { payload };
      },
    },
    createSuccess(state, action: PayloadAction<Schedule>) {
      state.saving = false;
      state.items = [action.payload, ...state.items];
    },
    createFailure(state, action: PayloadAction<string>) {
      state.saving = false;
      state.error = action.payload;
    },

    updateRequest: {
      reducer(state) {
        state.saving = true;
        state.error = undefined;
      },
      prepare(payload: { id: string; data: ScheduleUpdateInput }) {
        return { payload };
      },
    },
    updateSuccess(state, action: PayloadAction<Schedule>) {
      state.saving = false;
      state.items = state.items.map((s) =>
        s.id === action.payload.id ? action.payload : s,
      );
      if (state.current?.id === action.payload.id) state.current = action.payload;
    },
    updateFailure(state, action: PayloadAction<string>) {
      state.saving = false;
      state.error = action.payload;
    },

    deleteRequest: {
      reducer() {},
      prepare(id: string) {
        return { payload: id };
      },
    },
    deleteSuccess(state, action: PayloadAction<string>) {
      state.items = state.items.filter((s) => s.id !== action.payload);
    },

    pauseRequest: {
      reducer() {},
      prepare(id: string) {
        return { payload: id };
      },
    },
    resumeRequest: {
      reducer() {},
      prepare(id: string) {
        return { payload: id };
      },
    },
    statusToggleSuccess(state, action: PayloadAction<Schedule>) {
      state.items = state.items.map((s) =>
        s.id === action.payload.id ? action.payload : s,
      );
      if (state.current?.id === action.payload.id) state.current = action.payload;
    },

    runNowRequest: {
      reducer() {},
      prepare(id: string) {
        return { payload: id };
      },
    },
    runNowSuccess(state, _action: PayloadAction<{ run_id: string; schedule_id: string }>) {
      // Counter bump is server-side; we just clear stale errors.
      state.error = undefined;
    },

    fetchHistoryRequest: {
      reducer(state) {
        state.historyLoading = true;
      },
      prepare(id: string) {
        return { payload: id };
      },
    },
    fetchHistorySuccess(state, action: PayloadAction<ExecutionRun[]>) {
      state.historyLoading = false;
      state.history = action.payload;
    },
    fetchHistoryFailure(state, action: PayloadAction<string>) {
      state.historyLoading = false;
      state.error = action.payload;
    },

    clearError(state) {
      state.error = undefined;
    },
  },
});

export const {
  setFilters,
  fetchListRequest,
  fetchListSuccess,
  fetchListFailure,
  fetchOneRequest,
  fetchOneSuccess,
  fetchOneFailure,
  createRequest,
  createSuccess,
  createFailure,
  updateRequest,
  updateSuccess,
  updateFailure,
  deleteRequest,
  deleteSuccess,
  pauseRequest,
  resumeRequest,
  statusToggleSuccess,
  runNowRequest,
  runNowSuccess,
  fetchHistoryRequest,
  fetchHistorySuccess,
  fetchHistoryFailure,
  clearError,
} = slice.actions;
export default slice.reducer;
