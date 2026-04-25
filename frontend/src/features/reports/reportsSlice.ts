import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  DashboardKPIs,
  QualityOverview,
  QualityScore,
  RegressionItem,
  TrendPoint,
} from "@services/reportsApi";

export interface ReportsState {
  loading: boolean;
  kpis: DashboardKPIs | null;
  qualityScore: QualityScore | null;
  trend: TrendPoint[];
  overview: QualityOverview | null;
  regressions: RegressionItem[];
  regressionsLoading: boolean;
  error?: string;
}

const initialState: ReportsState = {
  loading: false,
  kpis: null,
  qualityScore: null,
  trend: [],
  overview: null,
  regressions: [],
  regressionsLoading: false,
};

const slice = createSlice({
  name: "reports",
  initialState,
  reducers: {
    fetchDashboardRequest: {
      reducer(state) {
        state.loading = true;
      },
      prepare(payload: { projectId: string; days?: number }) {
        return { payload };
      },
    },
    fetchDashboardSuccess(
      state,
      action: PayloadAction<{
        kpis: DashboardKPIs;
        qualityScore: QualityScore;
        trend: TrendPoint[];
        overview: QualityOverview;
      }>,
    ) {
      state.loading = false;
      state.kpis = action.payload.kpis;
      state.qualityScore = action.payload.qualityScore;
      state.trend = action.payload.trend;
      state.overview = action.payload.overview;
    },
    fetchDashboardFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    fetchRegressionsRequest: {
      reducer(state) {
        state.regressionsLoading = true;
      },
      prepare(payload: { projectId: string; limit?: number }) {
        return { payload };
      },
    },
    fetchRegressionsSuccess(state, action: PayloadAction<RegressionItem[]>) {
      state.regressionsLoading = false;
      state.regressions = action.payload;
    },
    fetchRegressionsFailure(state, action: PayloadAction<string>) {
      state.regressionsLoading = false;
      state.error = action.payload;
    },
    resetReports(state) {
      state.kpis = null;
      state.qualityScore = null;
      state.trend = [];
      state.overview = null;
      state.regressions = [];
      state.error = undefined;
    },
  },
});

export const {
  fetchDashboardRequest,
  fetchDashboardSuccess,
  fetchDashboardFailure,
  fetchRegressionsRequest,
  fetchRegressionsSuccess,
  fetchRegressionsFailure,
  resetReports,
} = slice.actions;
export default slice.reducer;
