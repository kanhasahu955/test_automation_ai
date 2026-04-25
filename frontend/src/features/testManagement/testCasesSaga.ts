import { call, put, takeLatest } from "redux-saga/effects";
import type { PayloadAction } from "@reduxjs/toolkit";

import { testCaseApi } from "@services/testCaseApi";
import type { Page, TestCase, TestCaseInput } from "@apptypes/api";
import { getApiErrorMessage as msg } from "@utils/apiErrors";

import {
  createFailure,
  createRequest,
  createSuccess,
  deleteRequest,
  deleteSuccess,
  fetchListFailure,
  fetchListRequest,
  fetchListSuccess,
  fetchOneRequest,
  fetchOneSuccess,
} from "./testCasesSlice";

function* fetchList(action: PayloadAction<{ projectId: string }>) {
  try {
    const page: Page<TestCase> = yield call(
      testCaseApi.list,
      action.payload.projectId,
      1,
      100,
    );
    yield put(fetchListSuccess(page.items));
  } catch (err) {
    yield put(fetchListFailure(msg(err, "Failed to load test cases")));
  }
}

function* fetchOne(action: PayloadAction<string>) {
  try {
    const tc: TestCase = yield call(testCaseApi.get, action.payload);
    yield put(fetchOneSuccess(tc));
  } catch {
    /* noop */
  }
}

function* createOne(
  action: PayloadAction<{ projectId: string; data: TestCaseInput }>,
) {
  try {
    const tc: TestCase = yield call(
      testCaseApi.create,
      action.payload.projectId,
      action.payload.data,
    );
    yield put(createSuccess(tc));
  } catch (err) {
    yield put(createFailure(msg(err, "Failed to create test case")));
  }
}

function* deleteOne(action: PayloadAction<string>) {
  try {
    yield call(testCaseApi.remove, action.payload);
    yield put(deleteSuccess(action.payload));
  } catch {
    /* noop */
  }
}

export default function* testCasesSaga() {
  yield takeLatest(fetchListRequest.type, fetchList);
  yield takeLatest(fetchOneRequest.type, fetchOne);
  yield takeLatest(createRequest.type, createOne);
  yield takeLatest(deleteRequest.type, deleteOne);
}
