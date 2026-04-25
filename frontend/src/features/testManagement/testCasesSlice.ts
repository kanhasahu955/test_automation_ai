import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { TestCase, TestCaseInput } from "@apptypes/api";

export interface TestCasesState {
  items: TestCase[];
  loading: boolean;
  saving: boolean;
  current: TestCase | null;
  error?: string;
}

const initialState: TestCasesState = {
  items: [],
  loading: false,
  saving: false,
  current: null,
};

const slice = createSlice({
  name: "testCases",
  initialState,
  reducers: {
    fetchListRequest: {
      reducer(state) {
        state.loading = true;
        state.error = undefined;
      },
      prepare(projectId: string) {
        return { payload: { projectId } };
      },
    },
    fetchListSuccess(state, action: PayloadAction<TestCase[]>) {
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
    fetchOneSuccess(state, action: PayloadAction<TestCase>) {
      state.loading = false;
      state.current = action.payload;
    },
    createRequest: {
      reducer(state) {
        state.saving = true;
      },
      prepare(payload: { projectId: string; data: TestCaseInput }) {
        return { payload };
      },
    },
    createSuccess(state, action: PayloadAction<TestCase>) {
      state.saving = false;
      state.items = [action.payload, ...state.items];
    },
    createFailure(state, action: PayloadAction<string>) {
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
      state.items = state.items.filter((t) => t.id !== action.payload);
    },
  },
});

export const {
  fetchListRequest,
  fetchListSuccess,
  fetchListFailure,
  fetchOneRequest,
  fetchOneSuccess,
  createRequest,
  createSuccess,
  createFailure,
  deleteRequest,
  deleteSuccess,
} = slice.actions;
export default slice.reducer;
