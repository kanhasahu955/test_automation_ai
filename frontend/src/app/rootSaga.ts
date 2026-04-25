import { all, fork } from "redux-saga/effects";

import aiSaga from "@features/aiGenerator/aiSaga";
import authSaga from "@features/auth/authSaga";
import executionsSaga from "@features/executions/executionsSaga";
import flowsSaga from "@features/noCodeDesigner/flowsSaga";
import projectsSaga from "@features/projects/projectsSaga";
import reportsSaga from "@features/reports/reportsSaga";
import schedulesSaga from "@features/schedules/schedulesSaga";
import stmSaga from "@features/stmConverter/stmSaga";
import testCasesSaga from "@features/testManagement/testCasesSaga";

export default function* rootSaga() {
  yield all([
    fork(authSaga),
    fork(projectsSaga),
    fork(testCasesSaga),
    fork(flowsSaga),
    fork(aiSaga),
    fork(stmSaga),
    fork(executionsSaga),
    fork(reportsSaga),
    fork(schedulesSaga),
  ]);
}
