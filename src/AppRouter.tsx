import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { PipelinesPage } from './pages/PipelinesPage';
import { PipelineDetailPage } from './pages/PipelineDetailPage';
import { ModelsPage } from './pages/ModelsPage';
import { DestinationsPage } from './pages/DestinationsPage';
import { DocsPage } from './pages/DocsPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { AdminPage } from './pages/AdminPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { ActivityLogsPage } from './pages/ActivityLogsPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AlertPreferencesPage from './pages/AlertPreferencesPage';
import { WizardRouter } from './wizard/WizardRouter';
import TestRollbackPage from './pages/TestRollbackPage';

function MainLayout() {
  const location = useLocation();
  const isUserDetailPage = location.pathname.match(/^\/admin\/users\/[^/]+$/);
  const isAlertPreferences = location.pathname === '/admin/alerts';

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />

      <div className="flex-1 flex flex-col ml-[72px]">
        {!isAlertPreferences && <Header />}

        <div className={`flex-1 ${isUserDetailPage ? 'overflow-hidden' : 'overflow-auto'}`}>
          <Routes>
                      <Route path="/" element={<Navigate to="/pipelines" replace />} />
                      <Route path="/pipelines" element={<PipelinesPage />} />
                      <Route path="/pipelines/new/*" element={<WizardRouter />} />
                      <Route path="/wizard/:pipelineId/*" element={<WizardRouter />} />
                      <Route path="/pipelines/:id" element={<PipelineDetailPage />} />
                      <Route path="/models" element={<ModelsPage />} />
                      <Route path="/destinations" element={<DestinationsPage />} />
                      <Route path="/docs" element={<DocsPage />} />
                      <Route
                        path="/admin"
                        element={
                          <ProtectedRoute requiredRole="admin">
                            <AdminDashboardPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/alerts"
                        element={
                          <ProtectedRoute requiredRole="admin">
                            <AlertPreferencesPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/users"
                        element={
                          <ProtectedRoute requiredRole="admin">
                            <AdminPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/users/:userId"
                        element={
                          <ProtectedRoute requiredRole="admin">
                            <UserDetailPage />
                          </ProtectedRoute>
                        }
                      />
            <Route path="/admin/activity-logs" element={<ActivityLogsPage />} />
            <Route path="/test-rollback" element={<TestRollbackPage />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
