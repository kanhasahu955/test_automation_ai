import type { PayloadAction } from "@reduxjs/toolkit";
import { call, put, takeLatest } from "redux-saga/effects";

import {
  stmApi,
  type StmAiScenariosPayload,
  type StmAiScenariosResponse,
  type StmDocument,
  type StmDocumentCompletePayload,
  type StmDocumentUpdatePayload,
  type StmManualDocPayload,
  type StmMapping,
  type StmMappingCreatePayload,
  type StmMappingUpdatePayload,
} from "@services/stmApi";
import { getApiErrorMessage as msg } from "@utils/apiErrors";

import {
  addMappingRequest,
  addMappingSuccess,
  aiScenariosFailure,
  aiScenariosRequest,
  aiScenariosSuccess,
  completeDocRequest,
  createManualFailure,
  createManualRequest,
  createManualSuccess,
  deleteDocRequest,
  deleteDocSuccess,
  deleteMappingRequest,
  deleteMappingSuccess,
  docFailure,
  docMutationSuccess,
  fetchDocsRequest,
  fetchDocsSuccess,
  fetchMappingsRequest,
  fetchMappingsSuccess,
  generateRequest,
  generateSuccess,
  mappingFailure,
  reopenDocRequest,
  runFailure,
  runRequest,
  runSuccess,
  updateDocRequest,
  updateMappingRequest,
  updateMappingSuccess,
  uploadFailure,
  uploadRequest,
  uploadSuccess,
} from "./stmSlice";

function* fetchDocs(action: PayloadAction<{ projectId: string }>) {
  try {
    const docs: StmDocument[] = yield call(stmApi.listDocuments, action.payload.projectId);
    yield put(fetchDocsSuccess(docs));
  } catch {
    /* noop */
  }
}

function* fetchMappings(action: PayloadAction<string>) {
  try {
    const mappings: StmMapping[] = yield call(stmApi.listMappings, action.payload);
    yield put(fetchMappingsSuccess(mappings));
  } catch {
    /* noop */
  }
}

function* upload(action: PayloadAction<{ projectId: string; file: File }>) {
  try {
    const doc: StmDocument = yield call(
      stmApi.upload,
      action.payload.projectId,
      action.payload.file,
    );
    yield put(uploadSuccess(doc));
  } catch (err) {
    yield put(uploadFailure(msg(err, "Failed to upload STM document")));
  }
}

function* createManual(
  action: PayloadAction<{ projectId: string; data: StmManualDocPayload }>,
) {
  try {
    const doc: StmDocument = yield call(
      stmApi.createManual,
      action.payload.projectId,
      action.payload.data,
    );
    yield put(createManualSuccess(doc));
  } catch (err) {
    yield put(createManualFailure(msg(err, "Failed to create STM document")));
  }
}

function* addMapping(
  action: PayloadAction<{ documentId: string; data: StmMappingCreatePayload }>,
) {
  try {
    const mapping: StmMapping = yield call(
      stmApi.addMapping,
      action.payload.documentId,
      action.payload.data,
    );
    yield put(addMappingSuccess(mapping));
  } catch (err) {
    yield put(mappingFailure(msg(err, "Failed to add mapping")));
  }
}

function* updateMapping(
  action: PayloadAction<{ mappingId: string; data: StmMappingUpdatePayload }>,
) {
  try {
    const mapping: StmMapping = yield call(
      stmApi.updateMapping,
      action.payload.mappingId,
      action.payload.data,
    );
    yield put(updateMappingSuccess(mapping));
  } catch (err) {
    yield put(mappingFailure(msg(err, "Failed to update mapping")));
  }
}

function* deleteMapping(action: PayloadAction<{ mappingId: string }>) {
  try {
    yield call(stmApi.deleteMapping, action.payload.mappingId);
    yield put(deleteMappingSuccess(action.payload.mappingId));
  } catch (err) {
    yield put(mappingFailure(msg(err, "Failed to delete mapping")));
  }
}

function* generate(
  action: PayloadAction<{ projectId: string; documentId: string; useAi?: boolean }>,
) {
  try {
    yield call(
      stmApi.generateSql,
      action.payload.projectId,
      action.payload.documentId,
      action.payload.useAi ?? true,
    );
    yield put(generateSuccess());
    const mappings: StmMapping[] = yield call(stmApi.listMappings, action.payload.documentId);
    yield put(fetchMappingsSuccess(mappings));
  } catch {
    yield put(generateSuccess());
  }
}

function* aiScenarios(
  action: PayloadAction<{
    projectId: string;
    documentId: string;
    data: StmAiScenariosPayload;
  }>,
) {
  try {
    const resp: StmAiScenariosResponse = yield call(
      stmApi.generateAiScenarios,
      action.payload.projectId,
      action.payload.documentId,
      action.payload.data,
    );
    yield put(
      aiScenariosSuccess({ mappings: resp.mappings, usedFallback: resp.used_fallback }),
    );
  } catch (err) {
    yield put(aiScenariosFailure(msg(err, "Failed to generate AI scenarios")));
  }
}

function* runValidation(
  action: PayloadAction<{ documentId: string; data_source_id?: string }>,
) {
  try {
    const resp: { run_id?: string } = yield call(stmApi.runValidation, action.payload.documentId, {
      data_source_id: action.payload.data_source_id,
      allow_destructive: false,
    });
    yield put(runSuccess(resp?.run_id || "queued"));
  } catch (err) {
    yield put(runFailure(msg(err, "Failed to run validation")));
  }
}

function* updateDoc(
  action: PayloadAction<{ documentId: string; data: StmDocumentUpdatePayload }>,
) {
  try {
    const doc: StmDocument = yield call(
      stmApi.updateDocument,
      action.payload.documentId,
      action.payload.data,
    );
    yield put(docMutationSuccess(doc));
  } catch (err) {
    yield put(docFailure(msg(err, "Failed to update STM document")));
  }
}

function* completeDoc(
  action: PayloadAction<{ documentId: string; data?: StmDocumentCompletePayload }>,
) {
  try {
    const doc: StmDocument = yield call(
      stmApi.completeDocument,
      action.payload.documentId,
      action.payload.data ?? {},
    );
    yield put(docMutationSuccess(doc));
  } catch (err) {
    yield put(docFailure(msg(err, "Failed to mark STM document complete")));
  }
}

function* reopenDoc(action: PayloadAction<{ documentId: string }>) {
  try {
    const doc: StmDocument = yield call(stmApi.reopenDocument, action.payload.documentId);
    yield put(docMutationSuccess(doc));
  } catch (err) {
    yield put(docFailure(msg(err, "Failed to reopen STM document")));
  }
}

function* deleteDoc(action: PayloadAction<{ documentId: string }>) {
  try {
    yield call(stmApi.deleteDocument, action.payload.documentId);
    yield put(deleteDocSuccess(action.payload.documentId));
  } catch (err) {
    yield put(docFailure(msg(err, "Failed to delete STM document")));
  }
}

export default function* stmSaga() {
  yield takeLatest(fetchDocsRequest.type, fetchDocs);
  yield takeLatest(fetchMappingsRequest.type, fetchMappings);
  yield takeLatest(uploadRequest.type, upload);
  yield takeLatest(createManualRequest.type, createManual);
  yield takeLatest(addMappingRequest.type, addMapping);
  yield takeLatest(updateMappingRequest.type, updateMapping);
  yield takeLatest(deleteMappingRequest.type, deleteMapping);
  yield takeLatest(generateRequest.type, generate);
  yield takeLatest(aiScenariosRequest.type, aiScenarios);
  yield takeLatest(runRequest.type, runValidation);
  yield takeLatest(updateDocRequest.type, updateDoc);
  yield takeLatest(completeDocRequest.type, completeDoc);
  yield takeLatest(reopenDocRequest.type, reopenDoc);
  yield takeLatest(deleteDocRequest.type, deleteDoc);
}
