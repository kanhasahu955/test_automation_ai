/**
 * Reusable chart primitives built on top of {@link https://recharts.org recharts}.
 *
 * Every chart in the app should go through one of these wrappers — they
 * lock in the project look (gradients, palette, tooltip style) and provide
 * loading / empty handling so feature pages can stay declarative.
 */
export { default as ChartFrame } from "./ChartFrame";
export { default as TrendBarChart, type TrendPoint } from "./TrendBarChart";
export { default as DonutChart, type DonutSlice } from "./DonutChart";
export { default as MiniSparkline } from "./MiniSparkline";
