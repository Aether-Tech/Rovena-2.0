import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAnalytics } from 'firebase/analytics';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBpx4aERcLoaRLulbpKOqeH1yu3MtBmktk",
    authDomain: "rova-25703.firebaseapp.com",
    projectId: "rova-25703",
    storageBucket: "rova-25703.firebasestorage.app",
    messagingSenderId: "983868326972",
    appId: "1:983868326972:web:e8368ecc01d0231e02af39",
    measurementId: "G-JYDFCLYN0F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Analytics (only in browser)
let analytics = null;
if (typeof window !== 'undefined') {
    analytics = getAnalytics(app);
}
export { analytics };

// Callable functions
export const checkSubscription = httpsCallable(functions, 'checkSubscription');
export const cancelSubscription = httpsCallable(functions, 'cancelSubscription');
export const sendChatMessage = httpsCallable(functions, 'sendChatMessage');
export const getUserTokens = httpsCallable(functions, 'getUserTokens');
export const updateUserTokens = httpsCallable(functions, 'updateUserTokens');

export default app;
