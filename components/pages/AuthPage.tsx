
import React, { useState, useEffect } from 'react';
import { BookOpen, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { signInWithPopup, signOut, setPersistence, browserLocalPersistence } from "firebase/auth";
import { auth, microsoftProvider } from "../../services/firebase";

interface AuthPageProps {
  onLogin: (email: string) => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isTouched, setIsTouched] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(err => 
      console.error("Failed to set persistence:", err)
    );
  }, []);

  const validateEmail = (value: string) => {
    if (!value) {
      setEmailError('Email is required');
      return false;
    }
    if (!value.endsWith('unimy.edu.my')) {
      setEmailError('Access restricted to University accounts (@unimy.edu.my)');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleMicrosoftLogin = async () => {
    if (isLoggingIn) return; 
    
    setIsLoggingIn(true);
    setEmailError('');

    try {
      const result = await signInWithPopup(auth, microsoftProvider);
      const loggedEmail = result.user?.email || "";
      
      const isValid = validateEmail(loggedEmail);
      if (!isValid) {
        await signOut(auth);
        return; 
      }

      onLogin(loggedEmail);
    } catch (error: any) {
      console.error("Microsoft Login failed:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setEmailError(''); 
      } else if (error.code === 'auth/popup-blocked') {
        setEmailError('Popup blocked. Please allow popups for this site.');
      } else {
        setEmailError('Login failed. Please try again.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-dark-bg p-4 transition-colors duration-300">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-full text-white mb-4 shadow-lg shadow-primary-600/30">
            <BookOpen size={32} />
          </div>
          <h1 className="text-4xl font-bold text-slate-800 dark:text-white tracking-tight">ExamVault</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">UNIMY's Collaborative Study Hub</p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-dark-surface p-8 rounded-2xl shadow-xl border border-slate-100 dark:border-zinc-800">
          <h2 className="text-2xl font-bold text-center text-slate-800 dark:text-white mb-6">Student Login</h2>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              University Email
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                disabled
                placeholder="Sign in using University Microsoft Account"
                className={`w-full px-4 py-3 border rounded-lg bg-slate-100 dark:bg-zinc-900 text-slate-400 dark:text-slate-500 cursor-not-allowed border-slate-300 dark:border-zinc-700 ${
                  emailError && isTouched ? 'border-red-300 text-red-900' : ''
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
              <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1 font-medium animate-in slide-in-from-top-1">
                {emailError}
              </p>
            )}
          </div>

          <button
            onClick={handleMicrosoftLogin}
            disabled={isLoggingIn}
            className={`w-full bg-primary-600 text-white font-bold py-4 px-4 rounded-xl hover:bg-primary-700 active:bg-primary-800 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-3 ${
                isLoggingIn ? 'opacity-75 cursor-not-allowed' : ''
            }`}
          >
            {isLoggingIn ? (
                <>
                    <Loader2 size={20} className="animate-spin" />
                    Signing in...
                </>
            ) : (
                "Sign in with Microsoft SSO"
            )}
          </button>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-zinc-800 text-center">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Protected area. Authorized personnel only.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};

export default AuthPage;
