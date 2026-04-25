import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { TokenResponse, User } from "@apptypes/api";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  status: "idle" | "loading" | "authenticated" | "error";
  error?: string;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  status: "idle",
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loginRequest: {
      reducer(state) {
        state.status = "loading";
        state.error = undefined;
      },
      prepare(payload: { email: string; password: string }) {
        return { payload };
      },
    },
    registerRequest: {
      reducer(state) {
        state.status = "loading";
        state.error = undefined;
      },
      prepare(payload: { name: string; email: string; password: string }) {
        return { payload };
      },
    },
    authSuccess(state, action: PayloadAction<TokenResponse>) {
      state.user = action.payload.user;
      state.accessToken = action.payload.access_token;
      state.refreshToken = action.payload.refresh_token;
      state.status = "authenticated";
      state.error = undefined;
    },
    authFailure(state, action: PayloadAction<string>) {
      state.status = "error";
      state.error = action.payload;
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
    logoutRequest() {},
    logoutSuccess(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.status = "idle";
      state.error = undefined;
    },
  },
});

export const {
  loginRequest,
  registerRequest,
  authSuccess,
  authFailure,
  setUser,
  logoutRequest,
  logoutSuccess,
} = authSlice.actions;
export default authSlice.reducer;
