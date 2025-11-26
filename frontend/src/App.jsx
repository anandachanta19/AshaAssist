import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import AdminDashboard from './pages/AdminDashboard';
import AdminPatientProfile from './pages/AdminPatientProfile';
import AdminPatients from './pages/AdminPatients';
import AdminUserProfile from './pages/AdminUserProfile';
import AdminUsers from './pages/AdminUsers';
import AlertsPage from './pages/Alerts'; // Added Alerts Page
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import VisitPage from './pages/VisitPage';
import Welcome from './pages/Welcome';

// Components
import AdminRoute from './components/AdminRoute';
import RootRedirect from './components/RootRedirect';
import UserRoute from './components/UserRoute';

/**
 * SharedRoute Component
 * Allows access to any authenticated user (Admin OR Asha Karmi).
 * Used for pages like Alerts and Visit Details that both roles need to see.
 */
const SharedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Root Path: Redirects based on role (User -> /home, Admin -> /admin/dashboard) */}
          <Route path="/" element={<RootRedirect />} />

          {/* Public Routes */}
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* --- Shared Protected Routes (Access: Admin & Asha Karmi) --- */}
          <Route
            path="/alerts"
            element={
              <SharedRoute>
                <AlertsPage />
              </SharedRoute>
            }
          />
          <Route
            path="/visit/:visitId"
            element={
              <SharedRoute>
                <VisitPage />
              </SharedRoute>
            }
          />

          {/* --- Protected User Routes (Access: Asha Karmi Only) --- */}
          <Route
            path="/home"
            element={
              <UserRoute>
                <Home />
              </UserRoute>
            }
          />

          {/* --- Protected Admin Routes (Access: Admin Only) --- */}
          <Route path="/admin" element={<AdminRoute />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<AdminUserProfile />} />
            <Route path="patients" element={<AdminPatients />} />
            <Route path="patients/:id" element={<AdminPatientProfile />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;