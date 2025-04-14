import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup,
  signOut,
  updateProfile,
  onAuthStateChanged,
  User
} from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, getDoc, query, where } from "firebase/firestore";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);
const firestore = getFirestore(app);

// We need to ensure the auth domain is set as the current host
// This is important for Firebase auth to work properly in certain environments like Replit
auth.useDeviceLanguage(); // Use browser's language for auth UI

// Authentication functions
export const loginWithEmail = (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const signupWithEmail = (email: string, password: string) => {
  return createUserWithEmailAndPassword(auth, email, password);
};

export const loginWithGoogle = async () => {
  console.log("Starting Google login with Firebase...");
  
  const provider = new GoogleAuthProvider();
  // Add scopes if needed
  provider.addScope('profile');
  provider.addScope('email');
  // Set custom parameters for Google Auth
  provider.setCustomParameters({
    prompt: 'select_account'
  });
  
  try {
    const result = await signInWithPopup(auth, provider);
    console.log("Google auth completed successfully");
    return result;
  } catch (error: any) {
    console.error("Firebase Google auth error:", error);
    
    // Only log as error if it's not a user cancellation
    if (error.code !== "auth/cancelled-popup-request" && 
        error.code !== "auth/popup-closed-by-user") {
      console.error("Google authentication error:", error.code, error.message);
    } else {
      console.log("User closed the Google auth popup");
    }
    
    throw error;
  }
};

export const logout = () => signOut(auth);

export const updateUserProfile = (user: User, data: { displayName?: string; photoURL?: string }) => {
  return updateProfile(user, data);
};

// Storage functions
export const uploadFile = async (file: File, path: string) => {
  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    console.log('Uploaded file successfully:', snapshot);
    return getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

// Firestore functions (helpers for CRUD operations)
export const createDocument = async (collectionName: string, data: any) => {
  try {
    const collectionRef = collection(firestore, collectionName);
    return await addDoc(collectionRef, {
      ...data,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`Error creating document in ${collectionName}:`, error);
    throw error;
  }
};

// Export Firebase instances
export { app, auth, storage, firestore, onAuthStateChanged };
