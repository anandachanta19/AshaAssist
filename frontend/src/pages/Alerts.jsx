/**
 * @file AlertsPage.jsx
 * @description Dashboard for ASHA workers to review high/medium priority medical alerts.
 * Fetches data directly from the Node.js backend (Port 8001).
 */

import axios from "axios"; // Import axios directly to bypass the global apiClient
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Loading from "../components/Loading";

// Define the specific URL for the Node.js Microservice
const NODE_BACKEND_URL = "http://localhost:8001";

// Helper to determine color based on severity
const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
        case "high": return "bg-red-900 text-red-200 border-red-700";
        case "medium": return "bg-orange-900 text-orange-200 border-orange-700";
        default: return "bg-gray-700 text-gray-300 border-gray-600";
    }
};

const AlertsPage = () => {
    const [visitsWithAlerts, setVisitsWithAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [expandedAlertId, setExpandedAlertId] = useState(null); // To toggle chat context view
    const navigate = useNavigate();

    useEffect(() => {
        fetchAlerts();
    }, []);

    const fetchAlerts = async () => {
        try {
            setLoading(true);
            setError(""); // Clear previous errors

            // DIRECT CALL to Node.js Backend (Port 8001)
            // We do not use 'apiClient' here because it points to Java (8000)
            const response = await axios.get(`${NODE_BACKEND_URL}/alerts/dashboard`);

            setVisitsWithAlerts(response.data.dashboardData || []);
        } catch (err) {
            console.error("Error fetching alerts:", err);
            setError("Failed to load alerts. Ensure Node server is running on port 8001.");
        } finally {
            setLoading(false);
        }
    };

    const toggleContext = (alertId) => {
        setExpandedAlertId(expandedAlertId === alertId ? null : alertId);
    };

    if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><Loading size="lg" /></div>;

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 p-6 md:p-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-white">Patient Health Alerts</h1>
                    <button
                        onClick={() => navigate(-1)}
                        className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-2"
                    >
                        ← Go Back
                    </button>
                </div>

                {error && <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg mb-6">{error}</div>}

                {visitsWithAlerts.length === 0 && !error ? (
                    <div className="text-center text-gray-400 py-12 bg-gray-800 rounded-xl border border-gray-700">
                        <p className="text-xl">✅ No active alerts found. Good job!</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {visitsWithAlerts.map((group) => (
                            <div key={group._id} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-lg">

                                {/* Header for the Visit Group */}
                                <div className="bg-gray-750 p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                                    <div>
                                        <h2 className="text-lg font-semibold text-white">Visit ID: {group._id}</h2>
                                        <p className="text-sm text-gray-400">
                                            Last Alert: {new Date(group.latestAlertDate).toLocaleString()}
                                        </p>
                                    </div>
                                    <Link
                                        to={`/visit/${group._id}`}
                                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition"
                                    >
                                        Open Full Chat
                                    </Link>
                                </div>

                                {/* List of Alerts for this Visit */}
                                <div className="p-4 space-y-4">
                                    {group.alerts.map((alert) => (
                                        <div key={alert._id} className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold uppercase tracking-wider text-xs border px-2 py-0.5 rounded bg-black/20">
                                                        {alert.severity}
                                                    </span>
                                                    <h3 className="font-bold text-lg">{alert.label}</h3>
                                                </div>
                                                <span className="text-xs opacity-75">{new Date(alert.createdAt).toLocaleTimeString()}</span>
                                            </div>

                                            <div className="mb-3">
                                                <p className="font-semibold">Reason:</p>
                                                <p className="opacity-90 mb-2">{alert.reason}</p>

                                                <p className="font-semibold">Recommended Action:</p>
                                                <p className="font-bold underline decoration-2 underline-offset-2">{alert.recommendedAction}</p>
                                            </div>

                                            {/* Toggle Triggering Messages (Root Cause) */}
                                            {alert.triggeringMessages && alert.triggeringMessages.length > 0 && (
                                                <div className="mt-4">
                                                    <button
                                                        onClick={() => toggleContext(alert._id)}
                                                        className="text-sm font-semibold underline opacity-80 hover:opacity-100 flex items-center gap-1"
                                                    >
                                                        {expandedAlertId === alert._id ? "Hide Chat Context" : "View Chat Context (Root Cause)"}
                                                    </button>

                                                    {expandedAlertId === alert._id && (
                                                        <div className="mt-2 bg-black/30 rounded p-3 text-sm space-y-2 border border-white/10">
                                                            {alert.triggeringMessages.map((msg, idx) => (
                                                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                                    <div className={`max-w-[85%] p-2 rounded ${msg.role === 'user' ? 'bg-blue-900/40 text-blue-100' : 'bg-gray-700/40 text-gray-200'}`}>
                                                                        <span className="block text-xs font-bold opacity-50 mb-0.5 uppercase">{msg.role === 'user' ? 'Health Worker' : 'Assistant'}</span>
                                                                        {msg.content}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AlertsPage;