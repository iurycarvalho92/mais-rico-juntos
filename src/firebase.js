import { initializeApp } from 'firebase/app';
import { getFirestore, persistentLocalCache, initializeFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore with persistent cache
let firestore;
try {
  firestore = initializeFirestore(app, {
    localCache: persistentLocalCache()
  });
} catch (e) {
  // Fallback if persistence fails (e.g. multiple tabs)
  firestore = getFirestore(app);
}

// Initialize Auth
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { firestore, auth, googleProvider, signInWithPopup, signOut };
