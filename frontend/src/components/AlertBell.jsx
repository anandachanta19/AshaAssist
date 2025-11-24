import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

// Alert / Warning Icon (Triangle with Exclamation)
const AlertIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
);

const AlertBell = () => {
    const [alertCount, setAlertCount] = useState(0);
    const NODE_BACKEND_URL = "http://localhost:8001";

    const fetchAlertStats = async () => {
        try {
            const response = await axios.get(`${NODE_BACKEND_URL}/alerts/dashboard`);
            // Calculate total alerts across all visits
            const dashboardData = response.data.dashboardData || [];
            const total = dashboardData.reduce((acc, curr) => acc + curr.totalAlerts, 0);
            setAlertCount(total);
        } catch (err) {
            console.error("Error fetching alert stats:", err);
        }
    };

    useEffect(() => {
        fetchAlertStats();
        // Refresh every 30 seconds to keep it "live"
        const interval = setInterval(fetchAlertStats, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <Link
            to="/alerts"
            className={`relative group p-2 transition ${alertCount > 0 ? 'text-red-400 hover:text-red-300' : 'text-gray-300 hover:text-white'}`}
        >
            <AlertIcon className="w-6 h-6" />

            {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-600 text-white text-xs font-bold flex items-center justify-center rounded-full border-2 border-gray-800 animate-bounce">
                    {alertCount}
                </span>
            )}

            <span className="absolute top-full mt-1 left-1/2 transform -translate-x-1/2 bg-black text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-50">
                Critical Alerts
            </span>
        </Link>
    );
};

export default AlertBell;
