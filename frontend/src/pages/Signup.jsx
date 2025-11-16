/**
 * @file Signup.jsx
 * @description Signup page for creating a new account with client-side validation.
 * @route /signup
 * @dependencies react-router-dom(useNavigate)
 * @api POST /auth/register → expects { username, fullName, password }
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
 * @component Signup
 * @description Renders the registration form; validates inputs; calls /auth/register; navigates to /login on success.
 */
const Signup = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [apiError, setApiError] = useState('');
  useEffect(() => {
    const newErrors = {};
    if (!formData.username.trim()) newErrors.username = 'Username is required.';
    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required.';
    if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long.';
    }
    setErrors(newErrors);
    setIsFormValid(Object.keys(newErrors).length === 0);
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
      const res = await fetch('http://localhost:8000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'An unknown error occurred' }));
        throw new Error(errorData.message || 'Signup failed');
      }

      // On successful registration, redirect to the login page.
      navigate('/login');

    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-900 p-4">
      <div className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700">
          <h2 className="text-3xl font-bold mb-2 text-center text-white">Create an Account</h2>
          <p className="text-center text-gray-400 mb-6">Welcome! Please fill in the details to get started.</p>

          {apiError && (
            <div className="bg-red-500/20 text-red-400 text-sm p-3 rounded-lg mb-4 text-center">
              {apiError}
            </div>
          )}
          <Input id="username" name="username" label="Username" value={formData.username} onChange={handleChange} error={errors.username && formData.username ? errors.username : ''} />
          <Input id="fullName" name="fullName" label="Full Name" value={formData.fullName} onChange={handleChange} error={errors.fullName && formData.fullName ? errors.fullName : ''} />
          <Input id="password" name="password" label="Password" type="password" value={formData.password} onChange={handleChange} error={errors.password && formData.password ? errors.password : ''} />
          
          <div className="mt-6">
            <Button type="submit" disabled={!isFormValid || loading} variant="primary">
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing Up...
                </>
              ) : 'Sign Up'}
            </Button>
          </div>
            <p className="text-center text-gray-400 text-sm mt-4">
                Already have an account?{' '}
                <button type="button" onClick={() => navigate('/login')} className="font-semibold text-blue-400 hover:underline">
                Log In
                </button>
            </p>
        </form>
      </div>
    </div>
  );
};

export default Signup;
