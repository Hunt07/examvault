
// services/firebase.ts
import { initializeApp } from "firebase/app";
import * as firebaseAuth from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Helper to get env vars safely with fallback
const getEnv = (key: string, fallback: string = "") => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    return import.meta.env[key] || fallback;
  }
  return fallback;
};

// 🔹 Your Firebase config using Environment Variables
// Prioritize Vite env vars, fallback to the hardcoded demo values if necessary
const firebaseConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY", " "), // Ensure you set VITE_FIREBASE_API_KEY in .env
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN", "examvault-live-07.firebaseapp.com"),
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID", "examvault-live-07"),
  storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET", "examvault-live-07.firebasestorage.app"),
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "346578928104"),
  appId: getEnv("VITE_FIREBASE_APP_ID", "1:346578928104:web:1fd6fe3cada5b19248245d")
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// 🔹 Auth
export const auth = firebaseAuth.getAuth(app);

// 🔹 Microsoft SSO Provider
export const microsoftProvider = new firebaseAuth.OAuthProvider("microsoft.com");

// Required scopes & parameters for SSO
microsoftProvider.setCustomParameters({ prompt: "select_account" });
microsoftProvider.addScope("email");
microsoftProvider.addScope("openid");
microsoftProvider.addScope("profile");

// 🔹 Firestore Database
export const db = getFirestore(app);

// 🔹 Storage
export const storage = getStorage(app);

export default app;
