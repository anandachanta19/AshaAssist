/**
 * @file AdminDashboard.jsx
 * @description Main dashboard for administrators to monitor app usage.
 */

import { AlertTriangle, ChevronRight, MessageSquare, Shield, Stethoscope, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../api';
import AlertBell from '../components/AlertBell';
import Loading from '../components/Loading';
import { useAuth } from '../context/AuthContext';

/**
 * AdminDashboard Component
 */
const AdminDashboard = () => {
  const [stats, setStats] = useState({ totalVisits: 0, totalPatients: 0, totalWorkers: 0 });
  const [recentVisits, setRecentVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [statsResponse, visitsResponse] = await Promise.all([
          apiClient.get('/admin/stats'),
          apiClient.get('/admin/recent-visits')
        ]);
        setStats(statsResponse.data);
        setRecentVisits(visitsResponse.data);
      } catch (err) {
        console.error("Failed to fetch admin data:", err);
        // Mock data fallback
        setStats({ totalVisits: 0, totalPatients: 0, totalWorkers: 0 });
        setRecentVisits([]);
        setError('Failed to load live data. Ensure admin API is running.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200">
      {/* Header */}
      <header className="bg-gray-800 shadow-md p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Shield size={20} className="text-blue-400" /> Asha Assist - Admin Panel
        </h1>
        <div className="flex items-center gap-4">
          <AlertBell />
          <span className="hidden md:inline">Welcome, {user?.username || 'Admin'}</span>

          <Link
            to="/admin/users"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-300 text-sm flex items-center gap-2"
          >
            <Users size={18} /> Manage Asha Karmis
          </Link>

          <Link
            to="/admin/patients"
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-300 text-sm flex items-center gap-2"
          >
            <Users size={18} /> Manage Patients
          </Link>

          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-300 text-sm"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 md:p-8">
        <h2 className="text-3xl font-semibold mb-6 text-white">Dashboard Overview</h2>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Total Verified Visits"
            value={stats.totalVisits}
            icon={<Stethoscope className="text-green-400" />}
            loading={loading}
          />
          <StatCard
            title="Total Patients"
            value={stats.totalPatients}
            icon={<Users className="text-blue-400" />}
            loading={loading}
          />
          <StatCard
            title="Total Asha Karmis"
            value={stats.totalWorkers}
            icon={<MessageSquare className="text-yellow-400" />}
            loading={loading}
          />
        </div>

        {/* Recent Visits Table */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-white">
            Recent Activity & Visit Review
          </h2>
          <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-lg">
            {loading && <Loading text="Loading recent visits..." />}
            {error && (
              <div className="p-4 text-center text-red-400 flex items-center justify-center gap-2">
                <AlertTriangle size={18} /> {error}
              </div>
            )}
            {!loading && !error && recentVisits.length > 0 && (
              <ul className="divide-y divide-gray-700">
                {recentVisits.map((visit) => (
                  <li key={visit.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-gray-700/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-semibold text-white">
                        Patient: {visit.patient?.fullName || 'N/A'}
                        <span className="ml-2 text-xs font-medium text-gray-400">(Visit ID: {visit.id})</span>
                      </p>
                      <p className="text-sm text-gray-400">
                        Asha Karmi: {visit.ashaKarmi?.username || 'N/A'}
                      </p>
                      <p className="text-sm text-gray-500">
                        Verified: {new Date(visit.verifiedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="w-full md:w-auto flex-shrink-0">
                      <Link
                        to={`/visit/${visit.id}`}
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-300 w-full md:w-auto"
                      >
                        Review Chat
                        <ChevronRight size={18} />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!loading && !error && recentVisits.length === 0 && (
              <p className="text-center p-4 text-gray-400">No recent visits found.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

/**
 * Helper component for displaying stats
 */
const StatCard = ({ title, value, icon, loading }) => (
  <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 flex items-center gap-6 shadow hover:border-gray-600 transition-colors">
    <div className="flex-shrink-0 p-4 bg-gray-900 rounded-full">
      {icon}
    </div>
    <div>
      <p className="text-sm font-medium text-gray-400">{title}</p>
      {loading ? (
        <div className="h-8 w-20 bg-gray-700 rounded-md animate-pulse mt-1"></div>
      ) : (
        <p className="text-3xl font-bold text-white">{value}</p>
      )}
    </div>
  </div>
);

export default AdminDashboard;