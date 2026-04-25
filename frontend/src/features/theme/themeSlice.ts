import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ThemeMode = "light" | "dark";
export type ThemeDensity = "comfortable" | "compact";

export type ThemeState = {
  mode: ThemeMode;
  /** Hex accent color (used for `colorPrimary`). */
  accent: string;
  density: ThemeDensity;
};

/**
 * Curated palette so users can re-skin the UI from settings without picking
 * from a colour wheel. Tokens are still the source of truth for everything
 * non-primary; this slice only swaps the primary/info colors.
 */
export const ACCENT_PRESETS: { id: string; label: string; value: string }[] = [
  { id: "indigo", label: "Indigo", value: "#6366f1" },
  { id: "violet", label: "Violet", value: "#8b5cf6" },
  { id: "cyan", label: "Cyan", value: "#06b6d4" },
  { id: "emerald", label: "Emerald", value: "#10b981" },
  { id: "rose", label: "Rose", value: "#f43f5e" },
  { id: "amber", label: "Amber", value: "#f59e0b" },
];

const initialState: ThemeState = {
  mode: "light",
  accent: ACCENT_PRESETS[0].value,
  density: "comfortable",
};

const themeSlice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    setThemeMode(state, action: PayloadAction<ThemeMode>) {
      state.mode = action.payload;
    },
    setAccent(state, action: PayloadAction<string>) {
      state.accent = action.payload;
    },
    setDensity(state, action: PayloadAction<ThemeDensity>) {
      state.density = action.payload;
    },
    resetTheme() {
      return initialState;
    },
  },
});

export const { setThemeMode, setAccent, setDensity, resetTheme } = themeSlice.actions;
export default themeSlice.reducer;
