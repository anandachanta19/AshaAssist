/**
 * @file Login.jsx
 * @description Login page that authenticates the user and saves a JWT for subsequent API calls.
 * @route /login
 * @dependencies react-router-dom(useNavigate), apiClient (Axios)
 * @api POST /auth/login → expects credentials; returns { accessToken }
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api';

const Input = ({ id, label, type = 'text', value, onChange, error }) => (
  <div className="mb-4">
    <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-2">
      {label}
    </label>
    <input
      type={type}
      id={id}
      name={id}
      value={value}
      onChange={onChange}
      className={`w-full px-4 py-2 bg-gray-700 border ${error ? 'border-red-500' : 'border-gray-600'} text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200`}
      required
    />
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);

const Button = ({ children, type = 'button', disabled = false, onClick, variant = 'primary' }) => {
  const baseClasses = "w-full text-white py-2.5 rounded-lg font-semibold flex items-center justify-center transition-all duration-300 disabled:cursor-not-allowed";
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500',
    success: 'bg-green-600 hover:bg-green-700 disabled:bg-gray-500',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]}`}
    >
      {children}
    </button>
  );
};

/**
 * @component Login
 * @description Renders the login form; validates inputs; calls /auth/login; saves token to localStorage; navigates to /home on success.
 * @state formData, loading, apiError, isFormValid
 */
const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [isFormValid, setIsFormValid] = useState(false);
  useEffect(() => {
    const { username, password } = formData;
    setIsFormValid(username.trim() !== '' && password.trim() !== '');
  }, [formData]);
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    setLoading(true);
    setApiError('');

    try {
      const response = await apiClient.post('/auth/login', formData);

      const token = response.data.accessToken;

      if (token) {
        console.log('Bearer Token:', token);

        localStorage.setItem('authToken', token);
        navigate('/home');
      } else {
        throw new Error("Token not found in the server response.");
      }

    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Login failed';
      setApiError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-900 p-4">
      <div className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700">
          <h2 className="text-3xl font-bold mb-2 text-center text-white">Welcome Back</h2>
          <p className="text-center text-gray-400 mb-6">Please log in to your account.</p>

          {apiError && (
            <div className="bg-red-500/20 text-red-400 text-sm p-3 rounded-lg mb-4 text-center">
              {apiError}
            </div>
          )}
          <Input id="username" label="Username" value={formData.username} onChange={handleChange} />
          <Input id="password" label="Password" type="password" value={formData.password} onChange={handleChange} />

          <div className="mt-6">
            <Button type="submit" disabled={!isFormValid || loading} variant="success">
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Logging In...
                </>
              ) : 'Login'}
            </Button>
          </div>
          <p className="text-center text-gray-400 text-sm mt-4">
            Don't have an account?{' '}
            <button type="button" onClick={() => navigate('/signup')} className="font-semibold text-blue-400 hover:underline">
              Sign Up
            </button>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;