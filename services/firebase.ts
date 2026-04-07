
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey:            "AIzaSyBarzcTnV3PB8-DP2UBWtHQwzsGOOi8BaA",
  authDomain:        "peakdone-27f4c.firebaseapp.com",
  projectId:         "peakdone-27f4c",
  storageBucket:     "peakdone-27f4c.firebasestorage.app",
  messagingSenderId: "703070354148",
  appId:             "1:703070354148:web:d3de4f017514fa6dfa4af1",
  measurementId:     "G-9CKFKGKSSE",
};

const app = initializeApp(firebaseConfig);

export const auth      = getAuth(app);
export const db        = getFirestore(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
