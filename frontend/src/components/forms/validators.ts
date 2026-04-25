import type { Rule } from "antd/es/form";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * Reusable AntD form rules — keep validation messages in one place so
 * tone and copy stay consistent across the app.
 *
 * @example
 *   <Form.Item name="email" rules={[required("Email"), email()]}>
 *     <Input />
 *   </Form.Item>
 */

/** Mark a field as required. `label` is just used to humanize the message. */
export const required = (label = "This field"): Rule => ({
  required: true,
  message: `${label} is required`,
});

/** Validate an RFC-ish email address. */
export const email = (): Rule => ({
  validator: (_rule, value) =>
    !value || EMAIL_RE.test(String(value))
      ? Promise.resolve()
      : Promise.reject(new Error("Enter a valid email address")),
});

/** Min/max length helpers. */
export const minLength = (n: number, label = "Value"): Rule => ({
  min: n,
  message: `${label} must be at least ${n} characters`,
});

export const maxLength = (n: number, label = "Value"): Rule => ({
  max: n,
  message: `${label} must be at most ${n} characters`,
});

/** Strong-ish password (8+, letters & digits, optional symbol). */
export const password = (): Rule => ({
  validator: (_rule, value) => {
    if (!value) return Promise.resolve();
    const v = String(value);
    if (v.length < 8) return Promise.reject(new Error("At least 8 characters"));
    if (!/[A-Za-z]/.test(v) || !/\d/.test(v))
      return Promise.reject(new Error("Mix letters and digits"));
    return Promise.resolve();
  },
});

/**
 * Confirm a field matches another (e.g. confirm-password).
 *
 * Use as a function rule so AntD passes us `getFieldValue`:
 * @example
 *   <Form.Item name="confirm" dependencies={["password"]} rules={[sameAs("password", "Passwords")]}>
 */
export const sameAs =
  (otherFieldName: string, label = "Field") =>
  ({ getFieldValue }: { getFieldValue: (name: string) => unknown }): Rule => ({
    validator(_rule, value) {
      if (!value || value === getFieldValue(otherFieldName)) return Promise.resolve();
      return Promise.reject(new Error(`${label} do not match`));
    },
  });

/** Validate an absolute http(s) URL. */
export const url = (): Rule => ({
  validator: (_rule, value) =>
    !value || URL_RE.test(String(value))
      ? Promise.resolve()
      : Promise.reject(new Error("Enter a valid http(s) URL")),
});

/** Lowercase slug: a-z, 0-9, dashes — no leading / trailing dashes. */
export const slug = (label = "Slug"): Rule => ({
  validator: (_rule, value) =>
    !value || SLUG_RE.test(String(value))
      ? Promise.resolve()
      : Promise.reject(
          new Error(`${label} must be lowercase letters, digits or dashes`),
        ),
});

/** Bounded integer. */
export const integer = (
  opts: { min?: number; max?: number; label?: string } = {},
): Rule => ({
  validator: (_rule, value) => {
    if (value === undefined || value === null || value === "") return Promise.resolve();
    const n = Number(value);
    const { min, max, label = "Value" } = opts;
    if (!Number.isInteger(n)) return Promise.reject(new Error(`${label} must be an integer`));
    if (min !== undefined && n < min)
      return Promise.reject(new Error(`${label} must be ≥ ${min}`));
    if (max !== undefined && n > max)
      return Promise.reject(new Error(`${label} must be ≤ ${max}`));
    return Promise.resolve();
  },
});

/** Cron expression — lazily imports `cron-parser` so it doesn't bloat any
 *  bundle that doesn't actually use cron validation. */
type CronParserShape = {
  CronExpressionParser?: { parse: (expr: string) => unknown };
  parseExpression?: (expr: string) => unknown;
};

export const cron = (): Rule => ({
  validator: async (_rule, value) => {
    if (!value) return Promise.resolve();
    try {
      const mod = (await import("cron-parser")) as unknown as CronParserShape & {
        default?: CronParserShape;
      };
      const parser: CronParserShape = mod.default ?? mod;
      const parse =
        parser.CronExpressionParser?.parse.bind(parser.CronExpressionParser) ??
        parser.parseExpression;
      if (!parse) throw new Error("cron-parser API not available");
      parse(String(value));
      return Promise.resolve();
    } catch {
      return Promise.reject(new Error("Enter a valid cron expression"));
    }
  },
});
