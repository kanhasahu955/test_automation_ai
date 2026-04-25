import { all, call, put, takeLatest } from "redux-saga/effects";
import type { PayloadAction } from "@reduxjs/toolkit";

import {
  reportsApi,
  type DashboardKPIs,
  type QualityOverview,
  type QualityScore,
  type RegressionItem,
  type TrendPoint,
} from "@services/reportsApi";
import { getApiErrorMessage as msg } from "@utils/apiErrors";

import {
  fetchDashboardFailure,
  fetchDashboardRequest,
  fetchDashboardSuccess,
  fetchRegressionsFailure,
  fetchRegressionsRequest,
  fetchRegressionsSuccess,
} from "./reportsSlice";

function* fetchDashboard(action: PayloadAction<{ projectId: string; days?: number }>) {
  try {
    const [kpis, qualityScore, trend, overview]: [
      DashboardKPIs,
      QualityScore,
      { points: TrendPoint[] },
      QualityOverview,
    ] = yield all([
      call(reportsApi.dashboard, action.payload.projectId),
      call(reportsApi.qualityScore, action.payload.projectId),
      call(reportsApi.trend, action.payload.projectId, action.payload.days ?? 14),
      call(reportsApi.overview, action.payload.projectId),
    ]);
    yield put(
      fetchDashboardSuccess({
        kpis,
        qualityScore,
        trend: trend.points || [],
        overview,
      }),
    );
  } catch (err) {
    yield put(fetchDashboardFailure(msg(err, "Failed to load dashboard")));
  }
}

function* fetchRegressions(action: PayloadAction<{ projectId: string; limit?: number }>) {
  try {
    const items: RegressionItem[] = yield call(
      reportsApi.regressions,
      action.payload.projectId,
      action.payload.limit ?? 50,
    );
    yield put(fetchRegressionsSuccess(items));
  } catch (err) {
    yield put(fetchRegressionsFailure(msg(err, "Failed to load regressions")));
  }
}

export default function* reportsSaga() {
  yield takeLatest(fetchDashboardRequest.type, fetchDashboard);
  yield takeLatest(fetchRegressionsRequest.type, fetchRegressions);
}
