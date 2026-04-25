import { useMemo } from "react";

import CodeBlock from "./CodeBlock";

type Props = {
  sql: string;
  title?: string;
  maxHeight?: number;
};

/** Common SQL keywords we want to nudge onto their own line for readability. */
const BREAKERS = [
  "SELECT",
  "FROM",
  "INNER JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "FULL JOIN",
  "JOIN",
  "WHERE",
  "GROUP BY",
  "HAVING",
  "ORDER BY",
  "LIMIT",
  "UNION ALL",
  "UNION",
  "INSERT INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE FROM",
];

/**
 * Lightweight SQL pretty-printer + copy panel.
 *
 * We deliberately avoid pulling a syntax highlighter into the bundle —
 * bumping each keyword to its own line covers ~95% of the readability win
 * for ad-hoc preview cards (STM SQL, generated assertions, profiling output).
 */
export const SqlView = ({ sql, title = "SQL", maxHeight = 320 }: Props) => {
  const formatted = useMemo(() => prettySql(sql), [sql]);
  return <CodeBlock code={formatted} language="sql" title={title} maxHeight={maxHeight} />;
};

function prettySql(input: string): string {
  if (!input) return "";
  let out = input.replace(/\s+/g, " ").trim();
  for (const kw of BREAKERS) {
    const re = new RegExp(`\\s${kw}\\s`, "gi");
    out = out.replace(re, `\n${kw} `);
  }
  return out.replace(/^\n+/, "");
}

export default SqlView;
