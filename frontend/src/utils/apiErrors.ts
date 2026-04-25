import axios, { type AxiosError } from "axios";

/**
 * Robust extractor for human-friendly error messages from anything thrown by
 * `apiClient` (or any other promise rejection).
 *
 * It understands every shape the backend can produce:
 *
 *   1. Our standard envelope (after `app/core/errors.py`):
 *        { error: { code, message, details? } }
 *   2. FastAPI's default `HTTPException` body:
 *        { detail: "..." }                  // string
 *        { detail: { message?, msg? } }     // dict
 *        { detail: [{ loc, msg, type }] }   // pydantic 422 list
 *   3. Plain `{ message: "..." }` (some upstream services use this).
 *   4. Raw string body (rare, but possible behind a proxy).
 *
 * Plus axios transport errors:
 *   * Timeout              → "The request took too long…"
 *   * No response (network)→ "Can't reach the server…"
 *   * Cancelled            → original cancel message (caller usually swallows)
 *
 * If it really can't find anything specific, it falls back to a status-aware
 * message ("Server error (500)") rather than the cryptic axios default
 * ("Request failed with status code 500").
 *
 * @example
 *   try { await api.foo() } catch (err) {
 *     yield put(failure(getApiErrorMessage(err, "Failed to load")));
 *   }
 */
export const getApiErrorMessage = (err: unknown, fallback: string): string => {
  // ------------------------------------------------------------------
  // 1) Axios errors — by far the most common branch
  // ------------------------------------------------------------------
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError;

    // 1a) Cancelled request — bubble up the original message so callers
    //     can tell apart "user navigated away" from real failures.
    if (axios.isCancel(err)) {
      return (err as { message?: string }).message || fallback;
    }

    // 1b) Transport-level: no response from server.
    if (!ax.response) {
      if (ax.code === "ECONNABORTED" || /timeout/i.test(ax.message)) {
        return "The request took too long. Please check your connection and try again.";
      }
      if (ax.code === "ERR_NETWORK") {
        return "Can't reach the server. Please check your connection.";
      }
      return ax.message || "Network error. Please try again.";
    }

    // 1c) Response received — try every known body shape, in priority order.
    const data = ax.response.data;
    const fromBody = extractFromBody(data);
    if (fromBody) return fromBody;

    // 1d) Last resort: status-aware fallback.
    return statusFallback(ax.response.status, fallback);
  }

  // ------------------------------------------------------------------
  // 2) Native JS errors (e.g. thrown inside a saga before the request)
  // ------------------------------------------------------------------
  if (err instanceof Error && err.message) return err.message;

  // ------------------------------------------------------------------
  // 3) String thrown directly (shouldn't happen, but be defensive)
  // ------------------------------------------------------------------
  if (typeof err === "string" && err.trim()) return err;

  return fallback;
};

/**
 * Walk the response body looking for the first usable string message.
 * Returns `null` if nothing structured is found.
 */
const extractFromBody = (data: unknown): string | null => {
  if (data == null) return null;

  // Raw text body — proxies / nginx error pages occasionally bypass JSON.
  if (typeof data === "string") {
    const trimmed = data.trim();
    return trimmed.length > 0 && trimmed.length < 500 ? trimmed : null;
  }

  if (typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;

  // 1) Our standard envelope.
  const envMsg = (obj.error as { message?: unknown } | undefined)?.message;
  if (typeof envMsg === "string" && envMsg.trim()) return envMsg;

  // 2) FastAPI default `detail`.
  const detail = obj.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    // pydantic-style: [{loc, msg, type}, ...] — surface the first.
    const first = detail[0] as { loc?: unknown[]; msg?: unknown } | undefined;
    if (first?.msg && typeof first.msg === "string") {
      const loc = Array.isArray(first.loc)
        ? first.loc.filter((p) => p !== "body").join(".")
        : "";
      return loc ? `${loc}: ${first.msg}` : first.msg;
    }
  }
  if (detail && typeof detail === "object") {
    const dObj = detail as Record<string, unknown>;
    if (typeof dObj.message === "string") return dObj.message;
    if (typeof dObj.msg === "string") return dObj.msg;
  }

  // 3) Plain top-level `{ message }`.
  if (typeof obj.message === "string" && obj.message.trim()) return obj.message;

  return null;
};

/**
 * Map an HTTP status code to a friendly default. Used only when the body
 * yields no usable text — keeps us from showing "Request failed with status
 * code 401" (axios default) to end users.
 */
const statusFallback = (status: number, fallback: string): string => {
  switch (status) {
    case 400:
      return "Bad request. Please check your input.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You don't have permission to perform this action.";
    case 404:
      return "We couldn't find what you were looking for.";
    case 409:
      return "This change conflicts with existing data.";
    case 422:
      return "Some fields are invalid. Please review and try again.";
    case 429:
      return "You're going a bit too fast. Please slow down and try again.";
    case 500:
      return "Something went wrong on our side. Please try again.";
    case 502:
    case 503:
    case 504:
      return "The service is temporarily unavailable. Please try again in a moment.";
    default:
      return status >= 500
        ? `Server error (${status}). Please try again.`
        : `${fallback} (${status})`;
  }
};

/**
 * Field-level errors from a 422 response, if present. Works against BOTH the
 * wrapped envelope (`error.details.errors`) and the FastAPI default shape
 * (`detail` is the pydantic list directly).
 *
 * @returns A `{ "field.path": "message" }` map, or `null` if there were none.
 */
export const getApiFieldErrors = (
  err: unknown,
): Record<string, string> | null => {
  if (!axios.isAxiosError(err)) return null;
  const data = err.response?.data as unknown;
  if (!data || typeof data !== "object") return null;

  const obj = data as Record<string, unknown>;

  type PydanticError = { loc: (string | number)[]; msg: string };
  let errors: PydanticError[] | null = null;

  // Wrapped envelope.
  const wrapped = (obj.error as { details?: { errors?: unknown } } | undefined)
    ?.details?.errors;
  if (Array.isArray(wrapped)) errors = wrapped as PydanticError[];

  // FastAPI default — `detail` is the list directly.
  if (!errors && Array.isArray(obj.detail)) {
    errors = obj.detail as PydanticError[];
  }

  if (!errors) return null;

  const out: Record<string, string> = {};
  for (const e of errors) {
    if (!e || !Array.isArray(e.loc) || typeof e.msg !== "string") continue;
    const field = e.loc.filter((p) => p !== "body").join(".");
    if (field) out[field] = e.msg;
  }
  return Object.keys(out).length ? out : null;
};

/**
 * Short, machine-readable error code from the backend envelope (e.g.
 * `"invalid_credentials"`, `"forbidden"`). Useful when the UI wants to branch
 * without parsing free-form messages.
 */
export const getApiErrorCode = (err: unknown): string | null => {
  if (!axios.isAxiosError(err)) return null;
  const data = err.response?.data as
    | { error?: { code?: unknown } }
    | undefined;
  const code = data?.error?.code;
  return typeof code === "string" ? code : null;
};
