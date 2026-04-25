/**
 * Frontend cron-builder helpers.
 *
 * The shape of `Cadence` mirrors the backend's discriminated union — the
 * server is the source of truth and the API echoes back the canonical cron
 * string, but we keep an in-browser builder + humanizer so the UI can
 * preview *before* a network round-trip.
 */
import { CronExpressionParser } from "cron-parser";
import cronstrue from "cronstrue";

export type CadenceKind = "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM";

export type HourlyCadence = { kind: "HOURLY"; minute: number };
export type DailyCadence = { kind: "DAILY"; hour: number; minute: number };
export type WeeklyCadence = {
  kind: "WEEKLY";
  hour: number;
  minute: number;
  /** 0 = Sunday … 6 = Saturday. */
  days_of_week: number[];
};
export type MonthlyCadence = {
  kind: "MONTHLY";
  day_of_month: number;
  hour: number;
  minute: number;
};
export type CustomCadence = { kind: "CUSTOM"; expression: string };

export type Cadence =
  | HourlyCadence
  | DailyCadence
  | WeeklyCadence
  | MonthlyCadence
  | CustomCadence;

/** Default cadence used when opening the builder for the first time. */
export const defaultCadence = (): DailyCadence => ({
  kind: "DAILY",
  hour: 2,
  minute: 0,
});

/**
 * Translate a cadence to its canonical 5-field cron expression.
 * Mirrors `app.modules.schedules.cron.cadence_to_cron` in the backend.
 */
export const cadenceToCron = (cadence: Cadence): string => {
  switch (cadence.kind) {
    case "HOURLY":
      return `${cadence.minute} * * * *`;
    case "DAILY":
      return `${cadence.minute} ${cadence.hour} * * *`;
    case "WEEKLY": {
      const dows = [...cadence.days_of_week].sort((a, b) => a - b);
      return `${cadence.minute} ${cadence.hour} * * ${dows.join(",")}`;
    }
    case "MONTHLY":
      return `${cadence.minute} ${cadence.hour} ${cadence.day_of_month} * *`;
    case "CUSTOM":
      return cadence.expression.trim();
    default:
      return "";
  }
};

/**
 * Validate a cron expression. Returns `null` on success, or an error message.
 * Empty / whitespace-only strings are reported as required.
 */
export const validateCron = (expression: string): string | null => {
  const expr = expression?.trim();
  if (!expr) return "Cron expression is required.";
  try {
    CronExpressionParser.parse(expr);
    return null;
  } catch (err) {
    return err instanceof Error
      ? err.message.replace(/^Error: /, "")
      : "Invalid cron expression";
  }
};

/**
 * Pretty-print a cron expression for the UI.
 *
 * Falls back to the raw expression if `cronstrue` cannot describe it (the
 * backend will still validate at save time).
 */
export const cronToHuman = (expression: string): string => {
  if (!expression?.trim()) return "";
  try {
    return cronstrue.toString(expression, { use24HourTimeFormat: true });
  } catch {
    return expression;
  }
};

/**
 * Compute the next *count* fire times for `expression` in the given
 * IANA `tz` (defaults to UTC). Returns ISO strings.
 */
export const nextRuns = (
  expression: string,
  tz = "UTC",
  count = 5,
): string[] => {
  if (!expression?.trim() || count <= 0) return [];
  try {
    const itr = CronExpressionParser.parse(expression, {
      currentDate: new Date(),
      tz,
    });
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      out.push(itr.next().toDate().toISOString());
    }
    return out;
  } catch {
    return [];
  }
};

/** A list of common IANA timezones we expose in the dropdown. */
export const COMMON_TIMEZONES: { value: string; label: string }[] = [
  { value: "UTC", label: "UTC" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Europe/Berlin", label: "Europe/Berlin" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "America/Chicago", label: "America/Chicago" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles" },
  { value: "Australia/Sydney", label: "Australia/Sydney" },
];

/** Day of week labels — index 0 = Sunday, matching cron + JS Date.getDay(). */
export const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
