/**
 * @file AdminPatients.jsx
 * @description Admin page to manage patients: List existing patients with search functionality.
 */

import { Search, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api';
import Loading from '../components/Loading';

const AdminPatients = () => {
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // --- Fetch Patients ---
    const fetchPatients = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/admin/patients');
            setPatients(response.data);
        } catch (err) {
            console.error("Failed to fetch patients:", err);
            setError('Failed to load patient list.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPatients();
    }, []);

    // --- Filter Patients ---
    const filteredPatients = patients.filter(patient =>
        patient.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (patient.phoneNumber && patient.phoneNumber.includes(searchTerm))
    );

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 p-6 md:p-8">

            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <User className="text-blue-500" size={32} /> Patient Management
                    </h1>
                    <p className="text-gray-400 mt-1">View and search patient records.</p>
                </div>
                <Link to="/admin/dashboard" className="text-blue-400 hover:underline">
                    ← Back to Dashboard
                </Link>
            </div>

            {/* Actions Bar */}
            <div className="flex justify-between items-center mb-6 bg-gray-800 p-4 rounded-xl border border-gray-700">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search patients by name or phone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg pl-10 pr-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Patients Table */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden shadow-lg">
                {loading ? (
                    <div className="p-8"><Loading text="Loading patients..." /></div>
                ) : error ? (
                    <div className="p-8 text-center text-red-400">{error}</div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-700 text-gray-300 uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-6 py-4">ID</th>
                                <th className="px-6 py-4">Full Name</th>
                                <th className="px-6 py-4">Date of Birth</th>
                                <th className="px-6 py-4">Gender</th>
                                <th className="px-6 py-4">Phone Number</th>
                                <th className="px-6 py-4">Address</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {filteredPatients.map((patient) => (
                                <tr key={patient.id} className="hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4 text-gray-400">#{patient.id}</td>
                                    <td className="px-6 py-4 font-medium text-white">{patient.fullName}</td>
                                    <td className="px-6 py-4 text-gray-300">{patient.dateOfBirth || 'N/A'}</td>
                                    <td className="px-6 py-4 text-gray-300">{patient.gender}</td>
                                    <td className="px-6 py-4 text-blue-400">{patient.phoneNumber}</td>
                                    <td className="px-6 py-4 text-gray-300">{patient.address || 'N/A'}</td>
                                    <td className="px-6 py-4 text-right">
                                        <Link
                                            to={`/admin/patients/${patient.id}`}
                                            className="text-blue-400 hover:text-blue-300 transition p-2 hover:bg-blue-900/20 rounded-full inline-block"
                                            title="View Profile"
                                        >
                                            <User size={18} />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {filteredPatients.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">No patients found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

        </div>
    );
};

export default AdminPatients;
