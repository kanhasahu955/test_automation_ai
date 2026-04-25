import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "@app/store";
import { setTokens, setUnauthorizedHandler } from "@services/apiClient";

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
      navigate("/login");
    });
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
