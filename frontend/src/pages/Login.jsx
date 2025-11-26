import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const auth = useAuth();

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const response = await apiClient.post('/auth/login', { username, password });
            const token = response.data.accessToken || response.data.token; 

            if (!token) {
                 throw new Error("No token received from server");
            }

            const user = auth.login(token);

            if (user && user.role) {
                if (user.role === 'ADMIN') {
                    navigate('/admin/dashboard');
                } else {
                    navigate('/home');
                }
            } else {
                throw new Error('Login successful but user role could not be determined.');
            }

        } catch (err) {
            console.error("Login failed:", err);
            setError('Invalid username or password. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-900 p-4">
            <div className="w-full max-w-md">
                <form onSubmit={handleLogin} className="bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700">
                    <h2 className="text-3xl font-bold mb-6 text-center text-white">Asha Assist Login</h2>
                    
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
                            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                        </div>
                    </div>

                    {error && <p className="text-red-400 mt-4 text-center">{error}</p>}

                    <div className="mt-8">
                        <button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-semibold transition duration-300 disabled:bg-gray-500">
                            {isLoading ? <Loading size="xs" inline text="Logging in..." color="white" /> : 'Login'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;