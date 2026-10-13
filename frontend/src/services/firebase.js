import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
} from "firebase/auth";

const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyDDzjh0nlCjMiUSNjbEceLMiEf3Co-5lNA",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    "campusbus-9e9a0.firebaseapp.com",
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || "campusbus-9e9a0",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "campusbus-9e9a0.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "562223304016",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:562223304016:web:3302dc7043ae09dc923055",
  measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-CG2MKK2N1F",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// Explicitly configure browserLocalPersistence so session persists across browser/tab restarts
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn("Failed to set browserLocalPersistence for Firebase Auth:", error);
});

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export { app, auth, googleProvider };
