import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

// Firebase API keys are PUBLIC by design (security is enforced via Firestore Rules + Auth).
// See: https://firebase.google.com/docs/projects/api-keys
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCe4jHvEbNbntoCv6h_u_MH5oMfvj1Ox_E",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mais-rico-juntos-v1.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mais-rico-juntos-v1",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mais-rico-juntos-v1.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "300763670024",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:300763670024:web:3d7922190583a1c23053bd",
};

console.log('[Firebase] Initializing with project:', firebaseConfig.projectId);

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore
const firestore = getFirestore(app);

// Initialize Auth
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { firestore, auth, googleProvider, signInWithPopup, signOut };
