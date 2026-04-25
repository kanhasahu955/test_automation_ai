import { call, put, takeLatest } from "redux-saga/effects";
import type { PayloadAction } from "@reduxjs/toolkit";

import { executionApi, type ExecutionResult, type ExecutionRun } from "@services/executionApi";

import {
  fetchReportRequest,
  fetchReportSuccess,
  fetchRunsRequest,
  fetchRunsSuccess,
} from "./executionsSlice";

function* fetchRuns(action: PayloadAction<{ projectId: string }>) {
  try {
    const runs: ExecutionRun[] = yield call(executionApi.list, action.payload.projectId);
    yield put(fetchRunsSuccess(runs));
  } catch {
    /* noop */
  }
}

function* fetchReport(action: PayloadAction<string>) {
  try {
    const report: { run: ExecutionRun; results: ExecutionResult[] } = yield call(
      executionApi.report,
      action.payload,
    );
    yield put(fetchReportSuccess(report));
  } catch {
    /* noop */
  }
}

export default function* executionsSaga() {
  yield takeLatest(fetchRunsRequest.type, fetchRuns);
  yield takeLatest(fetchReportRequest.type, fetchReport);
}
