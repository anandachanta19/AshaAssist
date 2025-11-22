import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode'; // Run: npm install jwt-decode

const AuthContext = createContext(null);

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

    // login function
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

    // logout function
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

// Custom hook to easily access auth state
export const useAuth = () => useContext(AuthContext);