import type { AxiosInstance, AxiosRequestConfig } from "axios";

import { apiClient } from "./apiClient";

/**
 * Typed base class for every domain API client.
 *
 * Subclasses get four short verbs (`get`, `post`, `put`, `delete`) that
 * automatically unwrap `response.data`, plus a `path()` helper that joins
 * the optional `basePath` with the relative URL passed in.
 *
 * Why a class?
 * - One place to add cross-cutting concerns (request id headers, retries, telemetry).
 * - Lets feature code call `this.get<...>("/foo")` and stay typed end-to-end.
 * - Subclasses are trivially mockable in tests via constructor injection.
 */
export abstract class BaseApiClient {
  protected readonly http: AxiosInstance;
  protected readonly basePath: string;

  constructor(basePath = "", http: AxiosInstance = apiClient) {
    this.http = http;
    this.basePath = basePath.replace(/\/$/, "");

    // Auto-bind every method on this instance (and its subclasses) so that
    // detached references like `yield call(authApi.login, ...)` in
    // redux-saga preserve `this`. Without this, `this.http` becomes
    // `undefined` and crashes with "Cannot read properties of null
    // (reading 'post')" — see authSaga.handleLogin et al.
    let proto: object | null = Object.getPrototypeOf(this);
    while (proto && proto !== Object.prototype) {
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (name === "constructor") continue;
        const value = (this as Record<string, unknown>)[name];
        if (typeof value === "function") {
          (this as Record<string, unknown>)[name] = value.bind(this);
        }
      }
      proto = Object.getPrototypeOf(proto);
    }
  }

  protected path(rel = ""): string {
    if (!rel) return this.basePath;
    const r = rel.startsWith("/") ? rel : `/${rel}`;
    return `${this.basePath}${r}`;
  }

  protected async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const { data } = await this.http.get<T>(this.path(url), config);
    return data;
  }

  protected async post<T, B = unknown>(
    url: string,
    body?: B,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const { data } = await this.http.post<T>(this.path(url), body, config);
    return data;
  }

  protected async put<T, B = unknown>(
    url: string,
    body?: B,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const { data } = await this.http.put<T>(this.path(url), body, config);
    return data;
  }

  protected async patch<T, B = unknown>(
    url: string,
    body?: B,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const { data } = await this.http.patch<T>(this.path(url), body, config);
    return data;
  }

  protected async delete<T = void>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const { data } = await this.http.delete<T>(this.path(url), config);
    return data;
  }
}
