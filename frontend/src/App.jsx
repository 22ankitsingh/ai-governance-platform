import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';

// Public pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';

// Citizen pages
import CitizenDashboard from './pages/citizen/CitizenDashboard';
import SubmitIssue from './pages/citizen/SubmitIssue';
import MyIssues from './pages/citizen/MyIssues';
import IssueDetail from './pages/citizen/IssueDetail';
import Notifications from './pages/citizen/Notifications';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import TriageQueue from './pages/admin/TriageQueue';
import IssueManage from './pages/admin/IssueManage';
import Analytics from './pages/admin/Analytics';
import AuditLog from './pages/admin/AuditLog';
import UserManage from './pages/admin/UserManage';

function AppRoutes() {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-spinner" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={
        isAuthenticated ? <Navigate to={isAdmin ? '/admin' : '/dashboard'} /> : <Login />
      } />
      <Route path="/register" element={
        isAuthenticated ? <Navigate to="/dashboard" /> : <Register />
      } />

      {/* Citizen routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute role="citizen">
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<CitizenDashboard />} />
        <Route path="submit" element={<SubmitIssue />} />
        <Route path="issues" element={<MyIssues />} />
        <Route path="issues/:id" element={<IssueDetail />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>

      {/* Admin routes */}
      <Route path="/admin" element={
        <ProtectedRoute role="admin">
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="triage" element={<TriageQueue />} />
        <Route path="issues/:id" element={<IssueManage />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="users" element={<UserManage />} />
        <Route path="audit-log" element={<AuditLog />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
