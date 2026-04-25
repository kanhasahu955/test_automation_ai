import { call, put, select, takeLatest } from "redux-saga/effects";
import type { PayloadAction } from "@reduxjs/toolkit";

import { authApi } from "@services/authApi";
import { setTokens } from "@services/apiClient";
import type { TokenResponse } from "@apptypes/api";
import type { RootState } from "@app/store";
import { getApiErrorMessage } from "@utils/apiErrors";

import {
  authFailure,
  authSuccess,
  loginRequest,
  logoutRequest,
  logoutSuccess,
  registerRequest,
} from "./authSlice";

function* handleLogin(action: PayloadAction<{ email: string; password: string }>) {
  try {
    const tokens: TokenResponse = yield call(
      authApi.login,
      action.payload.email,
      action.payload.password,
    );
    setTokens(tokens.access_token, tokens.refresh_token);
    yield put(authSuccess(tokens));
  } catch (err) {
    yield put(authFailure(getApiErrorMessage(err, "Login failed")));
  }
}

function* handleRegister(
  action: PayloadAction<{ name: string; email: string; password: string }>,
) {
  try {
    const tokens: TokenResponse = yield call(
      authApi.register,
      action.payload.name,
      action.payload.email,
      action.payload.password,
    );
    setTokens(tokens.access_token, tokens.refresh_token);
    yield put(authSuccess(tokens));
  } catch (err) {
    yield put(authFailure(getApiErrorMessage(err, "Registration failed")));
  }
}

function* handleLogout() {
  const refreshToken: string | null = yield select(
    (s: RootState) => s.auth.refreshToken,
  );
  try {
    if (refreshToken) {
      yield call(authApi.logout, refreshToken);
    }
  } catch {
    // ignore — local logout still proceeds
  }
  setTokens(null, null);
  yield put(logoutSuccess());
}

export default function* authSaga() {
  yield takeLatest(loginRequest.type, handleLogin);
  yield takeLatest(registerRequest.type, handleRegister);
  yield takeLatest(logoutRequest.type, handleLogout);
}
