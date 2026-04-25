import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { CompiledFlow, Flow, FlowInput } from "@apptypes/api";

export interface FlowsState {
  items: Flow[];
  loading: boolean;
  saving: boolean;
  current: Flow | null;
  compiled: CompiledFlow | null;
  lastRunId: string | null;
  error?: string;
}

const initialState: FlowsState = {
  items: [],
  loading: false,
  saving: false,
  current: null,
  compiled: null,
  lastRunId: null,
};

const slice = createSlice({
  name: "flows",
  initialState,
  reducers: {
    fetchListRequest: {
      reducer(state) {
        state.loading = true;
      },
      prepare(projectId: string) {
        return { payload: { projectId } };
      },
    },
    fetchListSuccess(state, action: PayloadAction<Flow[]>) {
      state.loading = false;
      state.items = action.payload;
    },
    fetchListFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    saveRequest: {
      reducer(state) {
        state.saving = true;
        state.error = undefined;
      },
      prepare(payload: { projectId: string; flowId?: string; data: FlowInput }) {
        return { payload };
      },
    },
    saveSuccess(state, action: PayloadAction<Flow>) {
      state.saving = false;
      state.current = action.payload;
      const idx = state.items.findIndex((f) => f.id === action.payload.id);
      if (idx >= 0) state.items[idx] = action.payload;
      else state.items.unshift(action.payload);
    },
    saveFailure(state, action: PayloadAction<string>) {
      state.saving = false;
      state.error = action.payload;
    },
    compileRequest: {
      reducer() {},
      prepare(id: string) {
        return { payload: id };
      },
    },
    compileSuccess(state, action: PayloadAction<CompiledFlow>) {
      state.compiled = action.payload;
    },
    runRequest: {
      reducer(state) {
        state.lastRunId = null;
      },
      prepare(id: string) {
        return { payload: id };
      },
    },
    runSuccess(state, action: PayloadAction<string>) {
      state.lastRunId = action.payload;
    },
    setCurrent(state, action: PayloadAction<Flow | null>) {
      state.current = action.payload;
      state.compiled = null;
    },
  },
});

export const {
  fetchListRequest,
  fetchListSuccess,
  fetchListFailure,
  saveRequest,
  saveSuccess,
  saveFailure,
  compileRequest,
  compileSuccess,
  runRequest,
  runSuccess,
  setCurrent,
} = slice.actions;
export default slice.reducer;
