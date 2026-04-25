import { call, put, takeLatest } from "redux-saga/effects";
import type { PayloadAction } from "@reduxjs/toolkit";

import {
  aiApi,
  type AiStatus,
  type EdgeCasesResponse,
  type GenerateFlowResponse,
  type GenerateTestCasesResponse,
} from "@services/aiApi";
import { getApiErrorMessage as msg } from "@utils/apiErrors";

import {
  aiFailure,
  analyzeFailureRequest,
  analyzeFailureSuccess,
  edgeCasesRequest,
  edgeCasesSuccess,
  fetchAiStatusRequest,
  fetchAiStatusSuccess,
  generateFlowRequest,
  generateFlowSuccess,
  generateTestCasesRequest,
  generateTestCasesSuccess,
  type FailureAnalysis,
} from "./aiSlice";

function* fetchStatus() {
  try {
    const status: AiStatus = yield call(aiApi.status);
    yield put(fetchAiStatusSuccess(status));
  } catch {
    // Status is best-effort — don't show a banner for it.
  }
}

function* genTestCases(
  action: PayloadAction<{ requirement: string; count?: number }>,
) {
  try {
    const resp: GenerateTestCasesResponse = yield call(
      aiApi.generateTestCases,
      action.payload.requirement,
      action.payload.count ?? 5,
    );
    yield put(
      generateTestCasesSuccess({
        items: resp.items || [],
        usedFallback: !!resp.used_fallback,
      }),
    );
  } catch (err) {
    yield put(aiFailure(msg(err, "AI generation failed")));
  }
}

function* genFlow(action: PayloadAction<{ scenario: string }>) {
  try {
    const resp: GenerateFlowResponse = yield call(
      aiApi.generateFlow,
      action.payload.scenario,
    );
    yield put(
      generateFlowSuccess({
        flow: resp.flow_json,
        usedFallback: !!resp.used_fallback,
      }),
    );
  } catch (err) {
    yield put(aiFailure(msg(err, "AI flow generation failed")));
  }
}

function* analyzeFailure(
  action: PayloadAction<{ test_name: string; error_message: string; logs?: string }>,
) {
  try {
    const resp: FailureAnalysis = yield call(
      aiApi.analyzeFailure,
      action.payload.test_name,
      action.payload.error_message,
      action.payload.logs,
    );
    yield put(analyzeFailureSuccess(resp));
  } catch (err) {
    yield put(aiFailure(msg(err, "Failure analysis failed")));
  }
}

function* edgeCases(action: PayloadAction<{ requirement: string }>) {
  try {
    const resp: EdgeCasesResponse = yield call(
      aiApi.edgeCases,
      action.payload.requirement,
    );
    yield put(
      edgeCasesSuccess({
        edgeCases: resp.edge_cases || [],
        usedFallback: !!resp.used_fallback,
      }),
    );
  } catch (err) {
    yield put(aiFailure(msg(err, "Edge case suggestion failed")));
  }
}

export default function* aiSaga() {
  yield takeLatest(fetchAiStatusRequest.type, fetchStatus);
  yield takeLatest(generateTestCasesRequest.type, genTestCases);
  yield takeLatest(generateFlowRequest.type, genFlow);
  yield takeLatest(analyzeFailureRequest.type, analyzeFailure);
  yield takeLatest(edgeCasesRequest.type, edgeCases);
}
