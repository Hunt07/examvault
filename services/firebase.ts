// services/firebase.ts
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import * as firebaseAuth from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
// Helper to get env vars safely
const getEnv = (key: string): string => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    const val = import.meta.env[key];
    return val ? val.trim() : "";
  }
  return "";
};

// Check if critical config exists
const apiKey = getEnv("AIzaSyCuN5mDneFpeI9ZVaiD6DRahRvSPGKGHZs");
const projectId = getEnv("examvault-live-07");
let app: FirebaseApp | undefined;
let auth: firebaseAuth.Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let microsoftProvider: firebaseAuth.OAuthProvider | undefined;
if (apiKey && projectId) {
  const firebaseConfig = {
    apiKey: apiKey,
    authDomain: getEnv("examvault-live-07.firebaseapp.com") || `${projectId}.firebaseapp.com`,
    projectId: projectId,
    storageBucket: getEnv("examvault-live-07.firebasestorage.app") || `${projectId}.firebasestorage.app`,
  messagingSenderId: getEnv("346578928104"),
  appId: getEnv("1:346578928104:web:1fd6fe3cada5b19248245d")
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
  console.warn("Firebase Configuration Missing: Check your .env file.");
}
export { app, auth, db, storage, microsoftProvider };
export default app;
