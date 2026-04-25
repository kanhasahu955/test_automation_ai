/**
 * Form-building primitives: section heads, submit footers, and a
 * shared validator vocabulary.
 *
 * @example
 *   import { FormSection, SubmitBar, required, email, password } from "@components/forms";
 */
export { default as FormSection } from "./FormSection";
export { default as SubmitBar } from "./SubmitBar";
export {
  required,
  email,
  password,
  sameAs,
  url,
  slug,
  integer,
  cron,
  minLength,
  maxLength,
} from "./validators";
