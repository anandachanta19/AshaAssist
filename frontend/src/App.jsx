import './App.css';

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';

import AdminDashboard from './pages/AdminDashboard';
import AdminPatientProfile from './pages/AdminPatientProfile';
import AdminPatients from './pages/AdminPatients';
import AdminUserProfile from './pages/AdminUserProfile';
import AdminUsers from './pages/AdminUsers';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import VisitPage from './pages/VisitPage';
import Welcome from './pages/Welcome';

import AdminRoute from './components/AdminRoute';
import RootRedirect from './components/RootRedirect';
import UserRoute from './components/UserRoute';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Root Path: Uses RootRedirect to send logged-in users to their dashboard 
             or unauthenticated users to the Welcome/Login page.
             If you want '/' to ALWAYS be Welcome, replace <RootRedirect /> with <Welcome />
          */}
          <Route path="/" element={<RootRedirect />} />

          {/* Public Routes */}
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected User Routes (Asha Karmi) */}
          <Route
            path="/home"
            element={
              <UserRoute>
                <Home />
              </UserRoute>
            }
          />
          <Route
            path="/visit/:visitId"
            element={
              <UserRoute>
                <VisitPage />
              </UserRoute>
            }
          />

          {/* Protected Admin Routes */}
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