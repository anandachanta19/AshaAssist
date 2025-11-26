import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './Loading';

/**
 * @component UserRoute
 * @description Protects routes for logged-in users (both USER and ADMIN).
 */
const UserRoute = ({ children }) => {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-900">
                <Loading text="Loading..." />
            </div>
        );
    }

    if (!user) {
        // Not logged in, redirect to login
        return <Navigate to="/login" replace />;
    }

    // User is logged in (can be ASHA_KARMI or ADMIN), allow access
    return children;
};

export default UserRoute;