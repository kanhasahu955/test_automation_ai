import { call, put, takeLatest } from "redux-saga/effects";
import type { PayloadAction } from "@reduxjs/toolkit";

import { projectsApi } from "@services/projectsApi";
import type { Page, Project } from "@apptypes/api";
import { getApiErrorMessage } from "@utils/apiErrors";

import {
  createProjectFailure,
  createProjectRequest,
  createProjectSuccess,
  fetchProjectRequest,
  fetchProjectSuccess,
  fetchProjectsFailure,
  fetchProjectsRequest,
  fetchProjectsSuccess,
} from "./projectsSlice";

function* fetchProjects() {
  try {
    const page: Page<Project> = yield call(projectsApi.list, 1, 100);
    yield put(fetchProjectsSuccess(page.items));
  } catch (err) {
    yield put(fetchProjectsFailure(getApiErrorMessage(err, "Failed to load projects")));
  }
}

function* createProject(
  action: PayloadAction<{ name: string; description?: string }>,
) {
  try {
    const project: Project = yield call(projectsApi.create, action.payload);
    yield put(createProjectSuccess(project));
  } catch (err) {
    yield put(createProjectFailure(getApiErrorMessage(err, "Failed to create project")));
  }
}

function* fetchProject(action: PayloadAction<string>) {
  try {
    const project: Project = yield call(projectsApi.get, action.payload);
    yield put(fetchProjectSuccess(project));
  } catch {
    // surface via error state if needed
  }
}

export default function* projectsSaga() {
  yield takeLatest(fetchProjectsRequest.type, fetchProjects);
  yield takeLatest(createProjectRequest.type, createProject);
  yield takeLatest(fetchProjectRequest.type, fetchProject);
}
