/**
 * @file Welcome.jsx
 * @description Public landing page for unauthenticated users with app intro and navigation.
 * @route / and /welcome
 * @dependencies react-router-dom(useNavigate)
 */

import { useNavigate } from 'react-router-dom';

/**
 * @component WelcomePage
 * @description Stateless landing screen with CTA buttons to /login and /signup.
 */
const WelcomePage = () => {
    const navigate = useNavigate();

    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-900 text-white p-4">
            <div className="w-full max-w-2xl text-center">
                <div className="bg-gray-800 p-10 md:p-16 rounded-2xl shadow-2xl border border-gray-700">

                    {/* Main heading for the welcome page */}
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 text-blue-400">
                        Welcome to Asha Assist
                    </h1>

                    {/* A brief description of the application's purpose */}
                    <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-xl mx-auto">
                        Your partner in community healthcare. Our platform is designed to help you securely verify patient visits and efficiently manage medical records, allowing you to focus on providing the best care.
                    </p>

                    {/* Container for action buttons */}
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-10">
                        {/* Button to navigate to the Login page */}
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white py-3 px-8 rounded-lg font-semibold transition-all duration-300"
                        >
                            Login
                        </button>
                        {/* Button to navigate to the Signup page */}
                        <button
                            onClick={() => navigate('/signup')}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white py-3 px-8 rounded-lg font-semibold transition-all duration-300"
                        >
                            Sign Up
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default WelcomePage;