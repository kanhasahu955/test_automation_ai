import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Project } from "@apptypes/api";

export interface ProjectsState {
  items: Project[];
  selectedId: string | null;
  selected: Project | null;
  loading: boolean;
  error?: string;
}

const initialState: ProjectsState = {
  items: [],
  selectedId: null,
  selected: null,
  loading: false,
};

const projectsSlice = createSlice({
  name: "projects",
  initialState,
  reducers: {
    fetchProjectsRequest(state) {
      state.loading = true;
      state.error = undefined;
    },
    fetchProjectsSuccess(state, action: PayloadAction<Project[]>) {
      state.loading = false;
      state.items = action.payload;
      if (state.selectedId) {
        const match = action.payload.find((p) => p.id === state.selectedId);
        if (match) state.selected = match;
      }
    },
    fetchProjectsFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    createProjectRequest: {
      reducer(state) {
        state.loading = true;
        state.error = undefined;
      },
      prepare(payload: { name: string; description?: string }) {
        return { payload };
      },
    },
    createProjectSuccess(state, action: PayloadAction<Project>) {
      state.loading = false;
      state.items = [action.payload, ...state.items];
      state.selected = action.payload;
      state.selectedId = action.payload.id;
    },
    createProjectFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    selectProject(state, action: PayloadAction<Project | null>) {
      state.selected = action.payload;
      state.selectedId = action.payload?.id ?? null;
    },
    fetchProjectRequest: {
      reducer() {},
      prepare(id: string) {
        return { payload: id };
      },
    },
    fetchProjectSuccess(state, action: PayloadAction<Project>) {
      state.selected = action.payload;
      state.selectedId = action.payload.id;
      const idx = state.items.findIndex((p) => p.id === action.payload.id);
      if (idx >= 0) state.items[idx] = action.payload;
      else state.items.unshift(action.payload);
    },
  },
});

export const {
  fetchProjectsRequest,
  fetchProjectsSuccess,
  fetchProjectsFailure,
  createProjectRequest,
  createProjectSuccess,
  createProjectFailure,
  selectProject,
  fetchProjectRequest,
  fetchProjectSuccess,
} = projectsSlice.actions;

export default projectsSlice.reducer;
