import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "@app/store";
import { setTokens, setUnauthorizedHandler } from "@services/apiClient";
import { connectSocket, disconnectSocket } from "@services/socket";

import {
  loginRequest,
  logoutRequest,
  logoutSuccess,
  registerRequest,
} from "./authSlice";

export const useAuth = () => {
  const auth = useAppSelector((s) => s.auth);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    setTokens(auth.accessToken, auth.refreshToken);
    setUnauthorizedHandler(() => {
      dispatch(logoutSuccess());
      disconnectSocket();
      navigate("/login");
    });
    // Drive the realtime singleton from auth state: connect once we have a
    // token, disconnect on logout. Re-renders with the same token are no-ops
    // because ``connectSocket()`` is idempotent.
    if (auth.accessToken) {
      connectSocket();
    } else {
      disconnectSocket();
    }
  }, [auth.accessToken, auth.refreshToken, dispatch, navigate]);

  const login = (email: string, password: string) =>
    dispatch(loginRequest({ email, password }));
  const register = (name: string, email: string, password: string) =>
    dispatch(registerRequest({ name, email, password }));
  const signOut = () => {
    dispatch(logoutRequest());
    navigate("/login");
  };

  return {
    user: auth.user,
    isAuthenticated: !!auth.accessToken && !!auth.user,
    status: auth.status,
    error: auth.error,
    login,
    register,
    signOut,
  };
};
