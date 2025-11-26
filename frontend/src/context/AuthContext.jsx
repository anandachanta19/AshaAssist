import { jwtDecode } from 'jwt-decode'; // Run: npm install jwt-decode
import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * Authentication Context
 * Stores the current user's authentication state (user object, loading status).
 */
const AuthContext = createContext(null);

/**
 * AuthProvider Component
 * 
 * Manages the authentication state of the application.
 * It checks for a valid JWT token in localStorage on initialization and provides login/logout functionality.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components that need access to the auth context
 * @returns {React.ReactNode} The context provider wrapping the children
 */
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check for token on initial app load
        try {
            const token = localStorage.getItem('authToken');
            if (token) {
                const decodedToken = jwtDecode(token);
                // Check if token is expired
                if (decodedToken.exp * 1000 > Date.now()) {
                    setUser({
                        username: decodedToken.sub,
                        role: decodedToken.role
                    });
                } else {
                    localStorage.removeItem('authToken');
                }
            }
        } catch (error) {
            console.error("Failed to decode token on load:", error);
            localStorage.removeItem('authToken');
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Logs in the user with the provided token.
     * Decodes the token to extract user details and updates the state.
     * 
     * @param {string} token - The JWT token received from the backend
     * @returns {Object|null} The user object if successful, or null if decoding fails
     */
    const login = (token) => {
        try {
            localStorage.setItem('authToken', token);
            const decodedToken = jwtDecode(token);
            const loggedInUser = {
                username: decodedToken.sub,
                role: decodedToken.role
            };
            setUser(loggedInUser);

            // --- MODIFIED: Return the user object ---
            return loggedInUser;
        } catch (error) {
            console.error("Failed to decode token on login:", error);
            return null; // Return null on failure
        }
    };

    /**
     * Logs out the user.
     * Removes the token from localStorage and clears the user state.
     */
    const logout = () => {
        localStorage.removeItem('authToken');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout }}>
            {/* Don't render children until loading is complete */}
            {!isLoading && children}
        </AuthContext.Provider>
    );
};

/**
 * Custom hook to access the authentication context.
 * 
 * @returns {Object} The authentication context value (user, isLoading, login, logout)
 */
export const useAuth = () => useContext(AuthContext);