/**
 * Extract a user-facing message from any thrown value (axios error, JS Error, …).
 *
 * Backend errors follow the contract:
 *   { error: { code: string; message: string; details?: object } }
 *
 * @example
 *   try { await api.foo() } catch (err) {
 *     yield put(failure(getApiErrorMessage(err, "Failed to load")));
 *   }
 */
export const getApiErrorMessage = (err: unknown, fallback: string): string => {
  const apiMsg = (err as {
    response?: { data?: { error?: { message?: string } } };
  })?.response?.data?.error?.message;
  if (apiMsg) return apiMsg;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

/** Field-level details from a 422 response, if present. */
export const getApiFieldErrors = (
  err: unknown,
): Record<string, string> | null => {
  const details = (err as {
    response?: { data?: { error?: { details?: { errors?: Array<{ loc: (string | number)[]; msg: string }> } } } };
  })?.response?.data?.error?.details?.errors;
  if (!details) return null;
  const out: Record<string, string> = {};
  for (const e of details) {
    const field = e.loc.filter((p) => p !== "body").join(".");
    if (field) out[field] = e.msg;
  }
  return Object.keys(out).length ? out : null;
};
