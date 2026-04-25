/**
 * Design tokens — single source of truth for colors, gradients, motion,
 * shadows and surface styles across the QualityForge UI.
 *
 * Use `tokens.*` everywhere instead of hardcoded hex values; that keeps the
 * "best theme, modern, animated" look consistent and easy to retheme.
 */
export const tokens = {
  color: {
    primary: "#6366f1",
    primarySoft: "#818cf8",
    primaryStrong: "#4f46e5",
    accent: "#06b6d4",
    accentSoft: "#22d3ee",
    pink: "#ec4899",
    violet: "#8b5cf6",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    bg: "#f6f7fb",
    bgSoft: "#eef0f7",
    surface: "#ffffff",
    surfaceMuted: "#f8fafc",
    border: "#e5e7eb",
    text: "#0f172a",
    textMuted: "#475569",
    textFaint: "#94a3b8",
    sidebarFrom: "#0b1020",
    sidebarVia: "#1a1f3a",
    sidebarTo: "#3b1d6b",
  },
  gradient: {
    brand: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)",
    brandSoft:
      "linear-gradient(135deg, rgba(99,102,241,0.16) 0%, rgba(139,92,246,0.14) 50%, rgba(6,182,212,0.16) 100%)",
    sidebar:
      "linear-gradient(180deg, #0b1020 0%, #1a1f3a 55%, #3b1d6b 100%)",
    aurora:
      "radial-gradient(1200px 600px at 0% 0%, rgba(99,102,241,0.18) 0%, transparent 60%), radial-gradient(900px 500px at 100% 0%, rgba(6,182,212,0.16) 0%, transparent 55%), radial-gradient(900px 600px at 50% 100%, rgba(236,72,153,0.10) 0%, transparent 60%)",
    glass:
      "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.7) 100%)",
  },
  shadow: {
    xs: "0 1px 2px rgba(15, 23, 42, 0.06)",
    sm: "0 2px 6px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
    md: "0 8px 24px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04)",
    lg: "0 24px 48px -12px rgba(15, 23, 42, 0.18)",
    glow: "0 10px 30px -10px rgba(99,102,241,0.45)",
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 22,
    pill: 999,
  },
  motion: {
    /** Standard easing curve for most UI motion (cubic-bezier tuple). */
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    /** Snappy easing for quick interactions. */
    easeOut: [0.16, 1, 0.3, 1] as [number, number, number, number],
    /** Spring-like overshoot for playful entrances. */
    spring: { type: "spring" as const, stiffness: 260, damping: 24 },
    duration: {
      fast: 0.18,
      base: 0.32,
      slow: 0.55,
    },
  },
} as const;

export type Tokens = typeof tokens;
