import { Routes, Route, Navigate } from "react-router-dom";
import { ROUTES } from "@/constants";
import { MainLayout } from "@/shared/components/layouts";
import { Spinner } from "@/shared/components/ui";

// Lazy load pages for better performance
import { lazy, Suspense } from "react";

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const ProjectWorkspacePage = lazy(() => import("@/pages/ProjectWorkspacePage"));
const ProjectListPage = lazy(
  () => import("@/features/project-list/ProjectListPage")
);

// Loading fallback
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Dashboard */}
        <Route
          path={ROUTES.DASHBOARD}
          element={
            <MainLayout>
              <DashboardPage />
            </MainLayout>
          }
        />

        {/* Projects List */}
        <Route
          path={ROUTES.PROJECTS}
          element={
            <MainLayout>
              <ProjectListPage />
            </MainLayout>
          }
        />

        {/* Workspace */}
        <Route
          path={ROUTES.AUDIT_LOGS}
          element={
            <MainLayout>
              <ProjectWorkspacePage />
            </MainLayout>
          }
        />

        {/* Redirect root to dashboard */}
        <Route
          path={ROUTES.HOME}
          element={<Navigate to={ROUTES.DASHBOARD} replace />}
        />

        {/* Redirect login to dashboard (bypass) */}
        <Route
          path={ROUTES.LOGIN}
          element={<Navigate to={ROUTES.DASHBOARD} replace />}
        />

        {/* 404 - Not Found */}
        <Route
          path="*"
          element={
            <div className="min-h-screen flex items-center justify-center bg-background">
              <div className="text-center">
                <h1 className="text-6xl font-bold text-muted-foreground">
                  404
                </h1>
                <p className="mt-4 text-lg text-muted-foreground">
                  Trang không tìm thấy
                </p>
              </div>
            </div>
          }
        />
      </Routes>
    </Suspense>
  );
}

export default App;
