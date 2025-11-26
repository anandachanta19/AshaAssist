import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './Loading';

/**
 * @component AdminRoute
 * @description Protects routes for ADMIN users only.
 */
const AdminRoute = () => {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-900">
                <Loading text="Checking permissions..." />
            </div>
        );
    }

    if (!user) {
        // Not logged in
        return <Navigate to="/login" replace />;
    }

    if (user.role !== 'ADMIN') {
        // Logged in, but NOT an admin
        console.warn("Access denied: User is not an admin.");
        return <Navigate to="/home" replace />;
    }

    // Logged in AND is an admin
    return <Outlet />; // Renders the nested child route (AdminDashboard)
};

export default AdminRoute;