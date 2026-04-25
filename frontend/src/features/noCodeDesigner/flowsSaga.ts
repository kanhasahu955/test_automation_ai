import { call, put, takeLatest } from "redux-saga/effects";
import type { PayloadAction } from "@reduxjs/toolkit";

import { flowApi } from "@services/flowApi";
import type { CompiledFlow, Flow, FlowInput } from "@apptypes/api";
import { getApiErrorMessage as msg } from "@utils/apiErrors";

import {
  compileRequest,
  compileSuccess,
  fetchListFailure,
  fetchListRequest,
  fetchListSuccess,
  runRequest,
  runSuccess,
  saveFailure,
  saveRequest,
  saveSuccess,
} from "./flowsSlice";

function* fetchList(action: PayloadAction<{ projectId: string }>) {
  try {
    const flows: Flow[] = yield call(flowApi.list, action.payload.projectId);
    yield put(fetchListSuccess(flows));
  } catch (err) {
    yield put(fetchListFailure(msg(err, "Failed to load flows")));
  }
}

function* save(
  action: PayloadAction<{ projectId: string; flowId?: string; data: FlowInput }>,
) {
  try {
    const flow: Flow = action.payload.flowId
      ? yield call(flowApi.update, action.payload.flowId, action.payload.data)
      : yield call(flowApi.create, action.payload.projectId, action.payload.data);
    yield put(saveSuccess(flow));
  } catch (err) {
    yield put(saveFailure(msg(err, "Failed to save flow")));
  }
}

function* compile(action: PayloadAction<string>) {
  try {
    const compiled: CompiledFlow = yield call(flowApi.compile, action.payload);
    yield put(compileSuccess(compiled));
  } catch {
    /* noop */
  }
}

function* run(action: PayloadAction<string>) {
  try {
    const result: { run_id?: string } = yield call(flowApi.run, action.payload);
    yield put(runSuccess(result?.run_id || "queued"));
  } catch {
    /* noop */
  }
}

export default function* flowsSaga() {
  yield takeLatest(fetchListRequest.type, fetchList);
  yield takeLatest(saveRequest.type, save);
  yield takeLatest(compileRequest.type, compile);
  yield takeLatest(runRequest.type, run);
}
