
import React, { useState } from 'react';
import { BookOpen, AlertCircle, CheckCircle } from 'lucide-react';
import { signInWithPopup, signOut, setPersistence, browserLocalPersistence } from "firebase/auth";
import { auth, microsoftProvider } from "../../services/firebase";

interface AuthPageProps {
  onLogin: (email: string) => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isTouched, setIsTouched] = useState(false);

  // Validate university email
  const validateEmail = (value: string) => {
    if (!value) {
      setEmailError('Email is required');
      return false;
    }
    if (!value.endsWith('@student.unimy.edu.my')) {
      setEmailError('Access restricted to @unimy.edu.my accounts');
      return false;
    }
    setEmailError('');
    return true;
  };

  // Handle Microsoft SSO login
  const handleMicrosoftLogin = async () => {
    try {
      // FORCE Persistence: This ensures the user stays logged in on refresh
      await setPersistence(auth, browserLocalPersistence);

      const result = await signInWithPopup(auth, microsoftProvider);
      const loggedEmail = result.user?.email || "";
      setEmail(loggedEmail);
      setIsTouched(true);

      const isValid = validateEmail(loggedEmail);
      if (!isValid) {
        await signOut(auth);
        alert("Restricted to University Email only!");
        return;
      }

      onLogin(loggedEmail);
    } catch (error: any) {
      console.error("Microsoft Login failed:", error);
      alert("Login failed: " + (error.message || JSON.stringify(error)));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-full text-white mb-4 shadow-lg shadow-primary-600/30">
            <BookOpen size={32} />
          </div>
          <h1 className="text-4xl font-bold text-slate-800 tracking-tight">ExamVault</h1>
          <p className="text-slate-500 mt-2 font-medium">Your University's Collaborative Study Hub</p>
        </div>

        {/* Login Card */}
        <div className="bg-white p-8 rounded-xl shadow-xl border border-slate-100">
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-6">Student Login</h2>

          {/* Email Preview + Status */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              University Email
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                disabled
                placeholder="Sign in using University Microsoft Account"
                className={`w-full px-4 py-3 border rounded-lg bg-slate-100 text-slate-400 cursor-not-allowed ${
                  emailError && isTouched
                    ? 'border-red-300 text-red-900'
                    : 'border-slate-300'
                }`}
              />

              {emailError && isTouched && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500">
                  <AlertCircle size={20} />
                </div>
              )}

              {!emailError && isTouched && email && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                  <CheckCircle size={20} />
                </div>
              )}
            </div>

            {emailError && isTouched && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1 font-medium animate-in slide-in-from-top-1">
                {emailError}
              </p>
            )}
          </div>

          {/* Microsoft SSO Button */}
          <button
            onClick={handleMicrosoftLogin}
            className="w-full bg-primary-600 text-white font-bold py-3.5 px-4 rounded-lg hover:bg-primary-700 active:bg-primary-800 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            Sign in with Microsoft SSO
          </button>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              Protected area. Authorized personnel only.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};

export default AuthPage;
