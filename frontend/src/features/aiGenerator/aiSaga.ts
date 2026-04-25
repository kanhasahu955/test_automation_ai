import { call, put, takeLatest } from "redux-saga/effects";
import type { PayloadAction } from "@reduxjs/toolkit";

import { aiApi, type GeneratedTestCase } from "@services/aiApi";
import { getApiErrorMessage as msg } from "@utils/apiErrors";

import {
  aiFailure,
  analyzeFailureRequest,
  analyzeFailureSuccess,
  edgeCasesRequest,
  edgeCasesSuccess,
  generateFlowRequest,
  generateFlowSuccess,
  generateTestCasesRequest,
  generateTestCasesSuccess,
  type FailureAnalysis,
} from "./aiSlice";

function* genTestCases(
  action: PayloadAction<{ requirement: string; count?: number }>,
) {
  try {
    const resp: { items: GeneratedTestCase[] } = yield call(
      aiApi.generateTestCases,
      action.payload.requirement,
      action.payload.count ?? 5,
    );
    yield put(generateTestCasesSuccess(resp.items || []));
  } catch (err) {
    yield put(aiFailure(msg(err, "AI generation failed")));
  }
}

function* genFlow(action: PayloadAction<{ scenario: string }>) {
  try {
    const resp: { flow_json: Record<string, unknown> } = yield call(
      aiApi.generateFlow,
      action.payload.scenario,
    );
    yield put(generateFlowSuccess(resp.flow_json));
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
    const resp: { edge_cases: string[] } = yield call(
      aiApi.edgeCases,
      action.payload.requirement,
    );
    yield put(edgeCasesSuccess(resp.edge_cases || []));
  } catch (err) {
    yield put(aiFailure(msg(err, "Edge case suggestion failed")));
  }
}

export default function* aiSaga() {
  yield takeLatest(generateTestCasesRequest.type, genTestCases);
  yield takeLatest(generateFlowRequest.type, genFlow);
  yield takeLatest(analyzeFailureRequest.type, analyzeFailure);
  yield takeLatest(edgeCasesRequest.type, edgeCases);
}
