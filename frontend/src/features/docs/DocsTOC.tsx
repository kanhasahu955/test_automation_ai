import { useEffect, useMemo, useState } from "react";

import { tokens } from "@theme/tokens";

type Heading = { id: string; text: string; level: number };

type DocsTOCProps = {
  /** A counter that changes when the active doc changes — re-runs heading scan. */
  contentKey: string;
};

/**
 * On-this-page table of contents. Reads `<h2>` and `<h3>` elements from the
 * rendered Markdown (which `rehype-slug` has decorated with stable IDs) and
 * highlights the heading currently in view via IntersectionObserver.
 */
export const DocsTOC = ({ contentKey }: DocsTOCProps) => {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const collected: Heading[] = [];
    document
      .querySelectorAll<HTMLElement>(".qf-markdown h2[id], .qf-markdown h3[id]")
      .forEach((el) => {
        collected.push({
          id: el.id,
          text: el.textContent ?? "",
          level: el.tagName === "H2" ? 2 : 3,
        });
      });
    setHeadings(collected);
    setActive(collected[0]?.id ?? "");
  }, [contentKey]);

  useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-110px 0px -70% 0px", threshold: [0, 1] },
    );
    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [headings]);

  const list = useMemo(() => headings, [headings]);

  if (list.length === 0) return null;

  return (
    <nav style={{ position: "sticky", top: 96, paddingLeft: 8 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: tokens.color.textFaint,
          marginBottom: 10,
          fontWeight: 600,
        }}
      >
        On this page
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
        {list.map((h) => {
          const isActive = h.id === active;
          return (
            <li key={h.id} style={{ paddingLeft: h.level === 3 ? 12 : 0 }}>
              <a
                href={`#${h.id}`}
                style={{
                  display: "block",
                  fontSize: 13,
                  lineHeight: 1.4,
                  padding: "4px 8px",
                  borderRadius: 6,
                  textDecoration: "none",
                  color: isActive ? tokens.color.primary : tokens.color.textMuted,
                  background: isActive ? "rgba(99,102,241,0.08)" : "transparent",
                  borderLeft: `2px solid ${isActive ? tokens.color.primary : "transparent"}`,
                  transition: "all 0.18s ease",
                }}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default DocsTOC;
