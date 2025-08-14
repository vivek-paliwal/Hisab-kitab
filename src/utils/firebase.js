import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD2_xnPcgLJVeCg9PLWa6DXomElr5HiWU4",
  authDomain: "hisab-kitab-app-521.firebaseapp.com",
  projectId: "hisab-kitab-app-521",
  storageBucket: "hisab-kitab-app-521.firebasestorage.app",
  messagingSenderId: "797351559453",
  appId: "1:797351559453:web:afa7c9ff30eefcad2921f4",
  measurementId: "G-V6JSCQJD7T"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;