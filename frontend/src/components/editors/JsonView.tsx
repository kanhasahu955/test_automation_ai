import { useMemo } from "react";

import CodeBlock from "./CodeBlock";

type Props = {
  /** Anything `JSON.stringify` can serialize. */
  value: unknown;
  /** Caption rendered in the header bar. */
  title?: string;
  /** Cap visible height; default 360. */
  maxHeight?: number;
  /** Pretty-print indent. Default `2`. */
  indent?: number;
};

/**
 * Readable JSON dump with copy support.
 *
 * Use this anywhere a feature page is rendering raw API output: AI flow
 * generation, STM payload preview, schedule next-run debugging, etc.
 *
 * Falls back to `String(value)` if serialization fails (e.g. circular refs)
 * so callers don't have to guard against that themselves.
 */
export const JsonView = ({ value, title = "JSON", maxHeight = 360, indent = 2 }: Props) => {
  const code = useMemo(() => {
    try {
      return JSON.stringify(value, null, indent);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown error";
      return `// Could not stringify value: ${reason}\n${String(value)}`;
    }
  }, [value, indent]);

  return <CodeBlock code={code} language="json" title={title} maxHeight={maxHeight} />;
};

export default JsonView;
