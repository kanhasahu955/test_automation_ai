import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

type RefreshResolver = (token: string | null) => void;

/**
 * Single source of truth for auth state on the frontend.
 *
 * Owns the access/refresh tokens and the on-401 callback used to bounce
 * unauthenticated users back to the login page. Exposes idempotent
 * `setTokens()` / `clear()` methods so Redux Saga (login/logout/refresh) and
 * the persistence rehydration layer can stay coordinated.
 */
class TokenStore {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onUnauthorized: (() => void) | null = null;

  setTokens(access: string | null, refresh: string | null): void {
    this.accessToken = access;
    this.refreshToken = refresh;
  }

  setUnauthorizedHandler(cb: () => void): void {
    this.onUnauthorized = cb;
  }

  getAccess(): string | null {
    return this.accessToken;
  }

  getRefresh(): string | null {
    return this.refreshToken;
  }

  triggerUnauthorized(): void {
    this.onUnauthorized?.();
  }

  clear(): void {
    this.accessToken = null;
    this.refreshToken = null;
  }
}

const tokenStore = new TokenStore();

export const setTokens = (access: string | null, refresh: string | null): void =>
  tokenStore.setTokens(access, refresh);

export const setUnauthorizedHandler = (cb: () => void): void =>
  tokenStore.setUnauthorizedHandler(cb);

/**
 * Build a configured axios instance with:
 *  - Bearer token injection on every outgoing request.
 *  - Single-flight refresh-token rotation on 401 (queues concurrent retries).
 */
const createApiClient = (): AxiosInstance => {
  const instance = axios.create({
    baseURL,
    headers: { "Content-Type": "application/json" },
    timeout: 30_000,
  });

  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const access = tokenStore.getAccess();
    if (access && !config.headers.has("Authorization")) {
      config.headers.set("Authorization", `Bearer ${access}`);
    }
    return config;
  });

  let isRefreshing = false;
  let pending: RefreshResolver[] = [];

  instance.interceptors.response.use(
    (resp) => resp,
    async (error: AxiosError) => {
      const original = error.config as RetryConfig | undefined;
      const refresh = tokenStore.getRefresh();
      if (error.response?.status !== 401 || !original || original._retry || !refresh) {
        return Promise.reject(error);
      }
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pending.push((token) => {
            if (!token) return reject(error);
            original.headers.set("Authorization", `Bearer ${token}`);
            resolve(instance(original));
          });
        });
      }

      isRefreshing = true;
      try {
        const { data } = await axios.post(`${baseURL}/auth/refresh-token`, {
          refresh_token: refresh,
        });
        tokenStore.setTokens(data.access_token, data.refresh_token);
        pending.forEach((cb) => cb(data.access_token));
        pending = [];
        original.headers.set("Authorization", `Bearer ${data.access_token}`);
        return instance(original);
      } catch (err) {
        pending.forEach((cb) => cb(null));
        pending = [];
        tokenStore.triggerUnauthorized();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    },
  );

  return instance;
};

export const apiClient: AxiosInstance = createApiClient();
