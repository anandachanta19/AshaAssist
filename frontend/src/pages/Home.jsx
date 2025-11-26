/**
 * @file Home.jsx
 * @description Dashboard showing recent verified visits, OTP flow, and Alerts notification.
 * @route /home
 * @dependencies react-router-dom, react-phone-number-input, apiClient (Axios), AuthContext
 */

import { useEffect, useState } from "react";
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { Link, useNavigate } from "react-router-dom";
import apiClient from "../api";
import AlertBell from '../components/AlertBell';
import Loading from '../components/Loading';
import { useAuth } from "../context/AuthContext";

/**
 * @component HomePage
 * @description Renders the OTP verification flow, recent visits, and alert notifications.
 */
const HomePage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // --- State: OTP & Visit Flow ---
  const [step, setStep] = useState(1);
  const [isLoadingOtp, setIsLoadingOtp] = useState(false);
  const [errorOtp, setErrorOtp] = useState('');
  const [messageOtp, setMessageOtp] = useState('');
  const [visitId, setVisitId] = useState(null);
  const [otp, setOtp] = useState('');
  const [patientData, setPatientData] = useState({
    patientPhoneNumber: '', fullName: '', dateOfBirth: '', gender: '', address: ''
  });
  const [showOtpFlow, setShowOtpFlow] = useState(false);

  // --- State: Data & UI ---
  const [recentVisits, setRecentVisits] = useState([]);
  const [loadingVisits, setLoadingVisits] = useState(true);
  const [errorVisits, setErrorVisits] = useState("");

  // --- API Fetchers ---

  const fetchRecentVisits = async () => {
    try {
      setLoadingVisits(true);
      setErrorVisits("");
      const response = await apiClient.get("/visits/my-recent");
      setRecentVisits(response.data);
    } catch (err) {
      console.error("Error fetching recent visits:", err.response || err);
      setErrorVisits("Could not fetch recent visits.");
    } finally {
      setLoadingVisits(false);
    }
  };

  useEffect(() => {
    fetchRecentVisits();
  }, []);

  // --- Handlers: Form Inputs ---

  const handlePhoneChange = (value) => {
    setPatientData({ ...patientData, patientPhoneNumber: value || '' });
    if (step === 1) setErrorOtp('');
  };

  const handleChange = (e) => {
    setPatientData({ ...patientData, [e.target.name]: e.target.value });
    if (step === 2) setErrorOtp('');
  };

  // --- Handlers: OTP Flow ---

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    if (!patientData.patientPhoneNumber || !isValidPhoneNumber(patientData.patientPhoneNumber)) {
      setErrorOtp("Please enter a valid phone number (e.g., +91...).");
      return;
    }
    setIsLoadingOtp(true);
    setErrorOtp('');
    setMessageOtp('');
    try {
      const response = await apiClient.get(`/patients/exists/${patientData.patientPhoneNumber}`);
      const patientExists = response.data;

      if (patientExists) {
        setMessageOtp("Existing patient found. Sending OTP...");
        await sendOtpRequest({ patientPhoneNumber: patientData.patientPhoneNumber });
      } else {
        setMessageOtp("New patient. Please enter their details.");
        setStep(2);
      }
    } catch (err) {
      console.error("Error checking patient:", err.response || err);
      setErrorOtp('Failed to check patient status. Verify number and try again.');
    } finally {
      setIsLoadingOtp(false);
    }
  };

  const handleDetailsSubmit = async (e) => {
    e.preventDefault();
    if (!patientData.fullName) {
      setErrorOtp("Full Name is required for new patients.");
      return;
    }
    setIsLoadingOtp(true);
    setErrorOtp('');
    setMessageOtp('Saving details and sending OTP...');
    await sendOtpRequest(patientData);
  };

  const sendOtpRequest = async (payload) => {
    setIsLoadingOtp(true);
    setErrorOtp('');
    try {
      const response = await apiClient.post('/visits/start', payload);
      const receivedVisitId = response.data.id || response.data.visitId;

      if (!receivedVisitId) {
        throw new Error("Backend did not return a valid visit ID.");
      }

      setVisitId(receivedVisitId);
      setMessageOtp(`OTP sent to ${payload.patientPhoneNumber}. Visit ID: ${receivedVisitId}.`);
      setStep(3);
    } catch (err) {
      console.error("Error starting visit:", err);
      setErrorOtp(err.response?.data?.message || 'Failed to start visit or send OTP.');
      setStep(1);
    } finally {
      setIsLoadingOtp(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || !/^\d{6}$/.test(otp)) {
      setErrorOtp("Please enter the 6-digit OTP code.");
      return;
    }
    setIsLoadingOtp(true);
    setErrorOtp('');

    try {
      if (!visitId) throw new Error("Visit ID is missing.");

      await apiClient.post('/visits/verify', { visitId, otp });
      setMessageOtp("✅ Visit Verified Successfully!");

      // Refresh logic
      setTimeout(() => {
        resetOtpFlow();
        fetchRecentVisits();
      }, 2500);

    } catch (err) {
      console.error("OTP Verification Error:", err);
      setErrorOtp(err.response?.data || 'OTP verification failed.');
    } finally {
      setIsLoadingOtp(false);
    }
  };

  const resetOtpFlow = () => {
    setShowOtpFlow(false);
    setStep(1);
    setMessageOtp('');
    setErrorOtp('');
    setPatientData({ patientPhoneNumber: '', fullName: '', dateOfBirth: '', gender: '', address: '' });
    setOtp('');
    setVisitId(null);
  };

  // --- Handler: Auth ---

  const handleLogout = () => {
    logout(); // Uses AuthContext
    navigate("/login");
  };

  // --- Render ---

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200">

      {/* Header */}
      <header className="bg-gray-800 shadow-md p-4 flex justify-between items-center sticky top-0 z-50 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="relative">
            <h1 className="text-xl font-bold text-white">Asha Assist Dashboard</h1>
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          {/* Alerts Bell Icon */}
          <AlertBell />

          <div className="hidden md:block h-6 w-px bg-gray-600"></div>

          <span className="hidden md:inline">Welcome, {user?.name || user?.fullName || "Asha Karmi"}</span>

          <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1.5 px-4 rounded-lg transition duration-300 text-sm">
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 md:p-8">

        {/* OTP Flow Section */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 mb-8 shadow-lg">
          <h2 className="text-2xl font-bold text-blue-400 mb-4 text-center">
            Start & Verify New Patient Visit
          </h2>

          {!showOtpFlow ? (
            <div className="text-center">
              <p className="text-gray-400 mb-6">
                Click below to start verifying your next patient interaction.
              </p>
              <button
                onClick={() => setShowOtpFlow(true)}
                className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition duration-300"
              >
                Start New Visit Verification
              </button>
            </div>
          ) : (
            <div className="w-full max-w-md mx-auto">

              {/* Step 1: Phone Number */}
              {step === 1 && (
                <form onSubmit={handlePhoneSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="patientPhoneNumber" className="block text-sm font-medium text-gray-300 mb-2">Patient's Phone Number</label>
                    <PhoneInput
                      id="patientPhoneNumber"
                      international
                      countryCallingCodeEditable={false}
                      defaultCountry="IN"
                      value={patientData.patientPhoneNumber}
                      onChange={handlePhoneChange}
                      className="phone-input-container"
                      numberInputProps={{
                        className: "w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-blue-500 focus:border-blue-500",
                        required: true
                      }}
                    />
                  </div>
                  <button type="submit" disabled={isLoadingOtp} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                    {isLoadingOtp ? (<span className="inline-flex items-center gap-2"><Loading size="xs" inline color="white" />Checking...</span>) : 'Check Patient / Send OTP'}
                  </button>
                </form>
              )}

              {/* Step 2: New Patient Details */}
              {step === 2 && (
                <form onSubmit={handleDetailsSubmit} className="space-y-4">
                  <h3 className="text-xl text-center text-gray-300 mb-4">Enter New Patient Details</h3>
                  <p className="text-gray-400 text-center mb-2 text-sm">Phone: {patientData.patientPhoneNumber}</p>

                  <input name="fullName" placeholder="Full Name *" value={patientData.fullName} onChange={handleChange} required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                  <input name="dateOfBirth" placeholder="Date of Birth" type="date" value={patientData.dateOfBirth} onChange={handleChange} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                  <input name="gender" placeholder="Gender" value={patientData.gender} onChange={handleChange} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                  <input name="address" placeholder="Address" value={patientData.address} onChange={handleChange} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />

                  <button type="submit" disabled={isLoadingOtp} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg font-semibold mt-4 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isLoadingOtp ? (<span className="inline-flex items-center gap-2"><Loading size="xs" inline color="white" />Saving...</span>) : 'Save and Send OTP'}
                  </button>
                  <button type="button" onClick={() => { setStep(1); setErrorOtp(''); setMessageOtp(''); }} className="w-full text-center text-gray-400 hover:text-gray-200 text-sm mt-2">← Back to Phone</button>
                </form>
              )}

              {/* Step 3: Verify OTP */}
              {step === 3 && (
                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  <div>
                    <label htmlFor="otp" className="block text-sm font-medium text-gray-300 mb-2">Enter 6-digit OTP sent to {patientData.patientPhoneNumber}</label>
                    <input id="otp" type="text" value={otp} onChange={(e) => setOtp(e.target.value)} required placeholder="______" maxLength="6" className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-center text-xl tracking-[1em]" />
                  </div>
                  <button type="submit" disabled={isLoadingOtp} className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                    {isLoadingOtp ? (<span className="inline-flex items-center gap-2"><Loading size="xs" inline color="white" />Verifying...</span>) : 'Verify Visit'}
                  </button>
                </form>
              )}

              {/* Messages */}
              {messageOtp && <p className="text-green-400 mt-4 text-center">{messageOtp}</p>}
              {errorOtp && <p className="text-red-400 mt-4 text-center">{errorOtp}</p>}

              <div className="mt-4 text-center">
                <button onClick={resetOtpFlow} className="text-gray-400 hover:text-gray-200 text-sm">Cancel Verification</button>
              </div>
            </div>
          )}
        </div>

        {/* Recent Visits Section */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-white">Recent Verified Visits</h2>
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 shadow-lg min-h-[100px]">
            {loadingVisits && <div className="p-4"><Loading text="Loading visits..." size="md" /></div>}
            {errorVisits && <p className="text-center p-4 text-red-400">{errorVisits}</p>}

            {!loadingVisits && !errorVisits && recentVisits.length > 0 ? (
              <ul className="divide-y divide-gray-700">
                {recentVisits.map((visit) => (
                  <li key={visit.id} className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <p className="font-semibold text-white">Visit ID: {visit.id}</p>
                      <p className="text-gray-300">Patient: {visit.patient.fullName} ({visit.patient.phoneNumber})</p>
                      <p className="text-sm text-gray-500">Verified: {new Date(visit.verifiedAt).toLocaleString()}</p>
                    </div>
                    <div className="w-full md:w-auto flex-shrink-0">
                      <Link to={`/visit/${visit.id}`} className="block text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-300 w-full md:w-auto">
                        View Details / Chat
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (!loadingVisits && <p className="text-center p-4 text-gray-400">No recent verified visits.</p>)}
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomePage;