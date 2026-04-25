/**
 * Read-only code / data viewers shared across feature pages.
 *
 * - {@link CodeBlock}: dark `<pre>` panel with a copy button.
 * - {@link JsonView}:  CodeBlock specialized for arbitrary JS values.
 * - {@link SqlView}:   CodeBlock with cheap SQL re-flow (no highlighter dep).
 */
export { default as CodeBlock } from "./CodeBlock";
export { default as JsonView } from "./JsonView";
export { default as SqlView } from "./SqlView";
