/**
 * @file AdminUserProfile.jsx
 * @description Admin page to view details of a specific Asha Karmi (User).
 */

import { ArrowLeft, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import apiClient from '../api';
import Loading from '../components/Loading';

const AdminUserProfile = () => {
    const { id } = useParams();
    const [user, setUser] = useState(null);
    const [visits, setVisits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [userRes, visitsRes] = await Promise.all([
                    apiClient.get(`/admin/users/${id}`),
                    apiClient.get(`/admin/users/${id}/visits`)
                ]);
                setUser(userRes.data);
                setVisits(visitsRes.data);
            } catch (err) {
                console.error("Failed to fetch user details:", err);
                setError('Failed to load user profile.');
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchData();
        }
    }, [id]);

    if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><Loading text="Loading profile..." /></div>;
    if (error) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-red-400">{error}</div>;
    if (!user) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-gray-400">User not found.</div>;

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 p-6 md:p-8">
            {/* Header */}
            <div className="mb-8">
                <Link to="/admin/users" className="inline-flex items-center text-blue-400 hover:text-blue-300 mb-4 transition">
                    <ArrowLeft size={18} className="mr-2" /> Back to Users
                </Link>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <User className="text-blue-500" size={32} /> {user.fullName}
                </h1>
                <p className="text-gray-400 mt-1">@{user.username} • {user.role}</p>
            </div>

            {/* Stats / Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h3 className="text-gray-400 text-sm font-medium uppercase mb-2">Total Visits</h3>
                    <p className="text-3xl font-bold text-white">{visits.length}</p>
                </div>
                {/* Add more stats if available, e.g., "Active Since", "Last Login" */}
            </div>

            {/* Visits History */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden shadow-lg">
                <div className="p-6 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white">Visit History</h2>
                </div>

                {visits.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No visits recorded for this user.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-700 text-gray-300 uppercase text-xs font-semibold">
                                <tr>
                                    <th className="px-6 py-4">Visit ID</th>
                                    <th className="px-6 py-4">Patient Name</th>
                                    <th className="px-6 py-4">Created Date</th>
                                    <th className="px-6 py-4">Verified</th>
                                    <th className="px-6 py-4">Verified At</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {visits.map((visit) => (
                                    <tr key={visit.id} className="hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 text-gray-400">#{visit.id}</td>
                                        <td className="px-6 py-4 font-medium text-white">
                                            {visit.patient?.fullName || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-300">
                                            {visit.createdAt ? new Date(visit.createdAt).toLocaleString() : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${visit.isVerified
                                                    ? 'bg-green-900 text-green-300'
                                                    : 'bg-yellow-900 text-yellow-300'
                                                }`}>
                                                {visit.isVerified ? 'Verified' : 'Pending'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-300">
                                            {visit.verifiedAt ? new Date(visit.verifiedAt).toLocaleString() : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link
                                                to={`/visit/${visit.id}`}
                                                className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                                            >
                                                View Details
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminUserProfile;
