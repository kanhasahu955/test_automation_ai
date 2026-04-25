import type { PayloadAction } from "@reduxjs/toolkit";
import { call, put, takeLatest } from "redux-saga/effects";

import { executionApi, type ExecutionRun } from "@services/executionApi";
import {
  scheduleApi,
  type Schedule,
  type ScheduleCreateInput,
  type ScheduleListFilters,
  type ScheduleUpdateInput,
} from "@services/scheduleApi";
import { getApiErrorMessage as msg } from "@utils/apiErrors";

import {
  createFailure,
  createRequest,
  createSuccess,
  deleteRequest,
  deleteSuccess,
  fetchHistoryFailure,
  fetchHistoryRequest,
  fetchHistorySuccess,
  fetchListFailure,
  fetchListRequest,
  fetchListSuccess,
  fetchOneFailure,
  fetchOneRequest,
  fetchOneSuccess,
  pauseRequest,
  resumeRequest,
  runNowRequest,
  runNowSuccess,
  statusToggleSuccess,
  updateFailure,
  updateRequest,
  updateSuccess,
} from "./schedulesSlice";

function* fetchList(
  action: PayloadAction<{ projectId: string; filters?: ScheduleListFilters }>,
) {
  try {
    const items: Schedule[] = yield call(
      scheduleApi.list,
      action.payload.projectId,
      action.payload.filters,
    );
    yield put(fetchListSuccess(items));
  } catch (err) {
    yield put(fetchListFailure(msg(err, "Failed to load schedules")));
  }
}

function* fetchOne(action: PayloadAction<string>) {
  try {
    const sch: Schedule = yield call(scheduleApi.get, action.payload);
    yield put(fetchOneSuccess(sch));
  } catch (err) {
    yield put(fetchOneFailure(msg(err, "Failed to load schedule")));
  }
}

function* createOne(
  action: PayloadAction<{ projectId: string; data: ScheduleCreateInput }>,
) {
  try {
    const sch: Schedule = yield call(
      scheduleApi.create,
      action.payload.projectId,
      action.payload.data,
    );
    yield put(createSuccess(sch));
  } catch (err) {
    yield put(createFailure(msg(err, "Failed to create schedule")));
  }
}

function* updateOne(
  action: PayloadAction<{ id: string; data: ScheduleUpdateInput }>,
) {
  try {
    const sch: Schedule = yield call(
      scheduleApi.update,
      action.payload.id,
      action.payload.data,
    );
    yield put(updateSuccess(sch));
  } catch (err) {
    yield put(updateFailure(msg(err, "Failed to update schedule")));
  }
}

function* deleteOne(action: PayloadAction<string>) {
  try {
    yield call(scheduleApi.remove, action.payload);
    yield put(deleteSuccess(action.payload));
  } catch (err) {
    yield put(fetchListFailure(msg(err, "Failed to delete schedule")));
  }
}

function* pauseOne(action: PayloadAction<string>) {
  try {
    const sch: Schedule = yield call(scheduleApi.pause, action.payload);
    yield put(statusToggleSuccess(sch));
  } catch (err) {
    yield put(fetchListFailure(msg(err, "Failed to pause schedule")));
  }
}

function* resumeOne(action: PayloadAction<string>) {
  try {
    const sch: Schedule = yield call(scheduleApi.resume, action.payload);
    yield put(statusToggleSuccess(sch));
  } catch (err) {
    yield put(fetchListFailure(msg(err, "Failed to resume schedule")));
  }
}

function* runNow(action: PayloadAction<string>) {
  try {
    const out: { ok: boolean; run_id: string; schedule_id: string } = yield call(
      scheduleApi.runNow,
      action.payload,
    );
    yield put(runNowSuccess(out));
  } catch (err) {
    yield put(fetchListFailure(msg(err, "Failed to trigger schedule")));
  }
}

function* fetchHistory(action: PayloadAction<string>) {
  try {
    const sch: Schedule = yield call(scheduleApi.get, action.payload);
    const runs: ExecutionRun[] = yield call(executionApi.list, sch.project_id, {
      scheduleId: sch.id,
      limit: 100,
    });
    yield put(fetchHistorySuccess(runs));
  } catch (err) {
    yield put(fetchHistoryFailure(msg(err, "Failed to load schedule history")));
  }
}

export default function* schedulesSaga() {
  yield takeLatest(fetchListRequest.type, fetchList);
  yield takeLatest(fetchOneRequest.type, fetchOne);
  yield takeLatest(createRequest.type, createOne);
  yield takeLatest(updateRequest.type, updateOne);
  yield takeLatest(deleteRequest.type, deleteOne);
  yield takeLatest(pauseRequest.type, pauseOne);
  yield takeLatest(resumeRequest.type, resumeOne);
  yield takeLatest(runNowRequest.type, runNow);
  yield takeLatest(fetchHistoryRequest.type, fetchHistory);
}
