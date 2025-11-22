/**
 * @file AdminUsers.jsx
 * @description Admin page to manage users: List existing Asha Karmis and register new ones.
 */

import { Plus, Search, Trash2, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api';
import Loading from '../components/Loading';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Registration Form State
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    password: ''
  });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState('');

  // --- Fetch Users ---
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/admin/users');
      setUsers(response.data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setError('Failed to load user list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // --- Handle Input Change ---
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // --- Filter Users ---
  const filteredUsers = users.filter(user =>
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- Handle Register Submit ---
  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterLoading(true);
    setRegisterError('');

    try {
      // Calls the existing auth registration endpoint
      await apiClient.post('/auth/register', formData);

      // Success: Refresh list, close modal, reset form
      await fetchUsers();
      setShowModal(false);
      setFormData({ fullName: '', username: '', password: '' });
      alert("Asha Karmi registered successfully!");
    } catch (err) {
      console.error("Registration failed:", err);
      setRegisterError(err.response?.data || "Failed to register user. Username might be taken.");
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 p-6 md:p-8">

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <User className="text-blue-500" size={32} /> User Management
          </h1>
          <p className="text-gray-400 mt-1">View and manage Asha Karmi accounts.</p>
        </div>
        <Link to="/admin/dashboard" className="text-blue-400 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>

      {/* Actions Bar */}
      <div className="flex justify-between items-center mb-6 bg-gray-800 p-4 rounded-xl border border-gray-700">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg pl-10 pr-4 py-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-300"
        >
          <Plus size={18} /> Register New Asha Karmi
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-8"><Loading text="Loading users..." /></div>
        ) : error ? (
          <div className="p-8 text-center text-red-400">{error}</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-700 text-gray-300 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Full Name</th>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 text-gray-400">#{user.id}</td>
                  <td className="px-6 py-4 font-medium text-white">{user.fullName}</td>
                  <td className="px-6 py-4 text-blue-400">{user.username}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.role === 'ADMIN' ? 'bg-purple-900 text-purple-300' : 'bg-blue-900 text-blue-300'
                      }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    <Link
                      to={`/admin/users/${user.id}`}
                      className="text-blue-400 hover:text-blue-300 transition p-2 hover:bg-blue-900/20 rounded-full"
                      title="View Profile"
                    >
                      <User size={18} />
                    </Link>
                    <button className="text-red-400 hover:text-red-300 transition p-2 hover:bg-red-900/20 rounded-full" title="Delete User">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* --- Registration Modal --- */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-bold text-white mb-6">Register New Asha Karmi</h2>

            {registerError && (
              <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-4 text-sm">
                {registerError}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Full Name</label>
                <input
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Anita Devi"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
                <input
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  placeholder="e.g. asha_anita"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  placeholder="••••••••"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerLoading}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition disabled:bg-gray-600 flex justify-center items-center gap-2"
                >
                  {registerLoading ? <Loading size="xs" inline color="white" /> : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminUsers;