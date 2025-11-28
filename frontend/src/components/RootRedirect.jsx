import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './Loading';

/**
 * @component RootRedirect
 * @description Redirects users from '/' to their correct dashboard or welcome page.
 */
const RootRedirect = () => {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        // Wait while AuthContext checks for a token
        return (
            <div className="flex h-screen items-center justify-center bg-gray-900">
                <Loading text="Loading user..." size="md" />
            </div>
        );
    }

    if (!user) {
        // No user, show welcome page
        return <Navigate to="/welcome" replace />;
    }

    // User exists, check role
    if (user.role === 'ADMIN') {
        return <Navigate to="/admin/dashboard" replace />;
    } else {
        // Assumes any other role (like 'ASHA_KARMI') goes to /home
        return <Navigate to="/home" replace />;
    }
};

export default RootRedirect;