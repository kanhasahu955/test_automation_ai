import { Spin } from "antd";
import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AppShell from "@components/layout/AppShell";
import LoginPage from "@features/auth/LoginPage";
import RegisterPage from "@features/auth/RegisterPage";
import ProtectedRoute from "@features/auth/ProtectedRoute";
import DashboardPage from "@features/dashboard/DashboardPage";
import ProjectsPage from "@features/projects/ProjectsPage";
import ProjectDetailPage from "@features/projects/ProjectDetailPage";
import TestCasesPage from "@features/testManagement/TestCasesPage";
import TestCaseDetailPage from "@features/testManagement/TestCaseDetailPage";
import TestSuitesPage from "@features/testManagement/TestSuitesPage";
import NoCodeDesignerPage from "@features/noCodeDesigner/NoCodeDesignerPage";
import FlowsListPage from "@features/noCodeDesigner/FlowsListPage";
import AIGeneratorPage from "@features/aiGenerator/AIGeneratorPage";
import StmConverterPage from "@features/stmConverter/StmConverterPage";
import DataProfilingPage from "@features/dataProfiling/DataProfilingPage";
import MetadataExplorerPage from "@features/metadataExplorer/MetadataExplorerPage";
import QualityMonitoringPage from "@features/qualityMonitoring/QualityMonitoringPage";
import ExecutionsPage from "@features/executions/ExecutionsPage";
import OperationsPage from "@features/operations/OperationsPage";
import ReportsPage from "@features/reports/ReportsPage";
import SchedulesListPage from "@features/schedules/SchedulesListPage";
import ScheduleDetailPage from "@features/schedules/ScheduleDetailPage";
import AuditLogsPage from "@features/auditLogs/AuditLogsPage";
import NotificationsPage from "@features/notifications/NotificationsPage";
import SettingsPage from "@features/settings/SettingsPage";

// Docs portal pulls in react-markdown + highlight.js; lazy-load to keep the
// initial bundle small. The first navigation to /docs fetches it on demand.
const DocsPage = lazy(() => import("@features/docs/DocsPage"));

const DocsFallback = () => (
  <div style={{ display: "grid", placeItems: "center", padding: 80 }}>
    <Spin size="large" />
  </div>
);

const App = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="test-cases" element={<TestCasesPage />} />
        <Route path="test-cases/:testCaseId" element={<TestCaseDetailPage />} />
        <Route path="test-suites" element={<TestSuitesPage />} />
        {/* `/flows/new` MUST come before `/flows/:flowId` so it isn't matched as `flowId === "new"`. */}
        <Route path="flows" element={<FlowsListPage />} />
        <Route path="flows/new" element={<NoCodeDesignerPage />} />
        <Route path="flows/:flowId" element={<NoCodeDesignerPage />} />
        <Route path="ai" element={<AIGeneratorPage />} />
        <Route path="stm" element={<StmConverterPage />} />
        <Route path="profiling" element={<DataProfilingPage />} />
        <Route path="metadata" element={<MetadataExplorerPage />} />
        <Route path="quality" element={<QualityMonitoringPage />} />
        <Route path="executions" element={<ExecutionsPage />} />
        <Route path="schedules" element={<SchedulesListPage />} />
        <Route path="schedules/:scheduleId" element={<ScheduleDetailPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route
          path="docs"
          element={
            <Suspense fallback={<DocsFallback />}>
              <DocsPage />
            </Suspense>
          }
        />
        <Route
          path="docs/:slug"
          element={
            <Suspense fallback={<DocsFallback />}>
              <DocsPage />
            </Suspense>
          }
        />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
);

export default App;
