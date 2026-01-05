
// services/firebase.ts
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import * as firebaseAuth from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

// Helper to get env vars safely with localStorage fallback for runtime config
const getEnv = (key: string): string => {
  // 1. Try standard Vite environment variables
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key].trim();
  }

  // 2. Try process.env (fallback for some environments)
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key]!.trim();
    }
  } catch (e) {}

  // 3. Try LocalStorage (User-entered config via UI)
  try {
    if (typeof window !== 'undefined') {
      const localVal = window.localStorage.getItem(`examvault_config_${key}`);
      if (localVal) return localVal.trim();
    }
  } catch (e) {}

  return "";
};

// Check if critical config exists
const apiKey = getEnv("VITE_FIREBASE_API_KEY");
const projectId = getEnv("VITE_FIREBASE_PROJECT_ID");

let app: FirebaseApp | undefined;
let auth: firebaseAuth.Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let microsoftProvider: firebaseAuth.OAuthProvider | undefined;

if (apiKey && projectId) {
  const firebaseConfig = {
    apiKey: apiKey,
    authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN") || `${projectId}.firebaseapp.com`,
    projectId: projectId,
    storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET") || `${projectId}.firebasestorage.app`,
    messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: getEnv("VITE_FIREBASE_APP_ID")
  };

  // Prevent multiple initializations in dev hot-reload
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }

  if (app) {
    auth = firebaseAuth.getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    
    microsoftProvider = new firebaseAuth.OAuthProvider("microsoft.com");
    microsoftProvider.setCustomParameters({ prompt: "select_account" });
    microsoftProvider.addScope("email");
    microsoftProvider.addScope("openid");
    microsoftProvider.addScope("profile");
  }
} else {
  // We don't error hard here, we let the UI handle the missing auth object
  console.log("Waiting for Firebase configuration...");
}

export { app, auth, db, storage, microsoftProvider };
export default app;
