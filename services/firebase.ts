
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

// Import the functions you need from the SDKs you need 
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCuN5mDneFpeI9ZVaiD6DRahRvSPGKGHZs",
  authDomain: "examvault-live-07.firebaseapp.com",
  projectId: "examvault-live-07",
  storageBucket: "examvault-live-07.firebasestorage.app",
  messagingSenderId: "346578928104",
  appId: "1:346578928104:web:1fd6fe3cada5b19248245d"
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
