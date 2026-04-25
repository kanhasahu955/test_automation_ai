import type { TokenResponse, User } from "@apptypes/api";

import { BaseApiClient } from "./BaseApiClient";

export class AuthApiClient extends BaseApiClient {
  constructor() {
    super("/auth");
  }

  login(email: string, password: string): Promise<TokenResponse> {
    return this.post<TokenResponse>("/login-json", { email, password });
  }

  register(name: string, email: string, password: string): Promise<TokenResponse> {
    return this.post<TokenResponse>("/register", { name, email, password });
  }

  refresh(refresh_token: string): Promise<TokenResponse> {
    return this.post<TokenResponse>("/refresh-token", { refresh_token });
  }

  logout(refresh_token: string): Promise<void> {
    return this.post<void>("/logout", { refresh_token });
  }

  me(): Promise<User> {
    return this.get<User>("/me");
  }
}

export const authApi = new AuthApiClient();
