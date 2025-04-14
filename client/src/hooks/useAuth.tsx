import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { 
  auth,
  loginWithEmail,
  signupWithEmail,
  loginWithGoogle,
  logout as firebaseLogout,
  updateUserProfile
} from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  signup: (email: string, password: string, displayName: string) => Promise<any>;
  loginWithGoogle: () => Promise<any>;
  logout: () => Promise<void>;
  updateProfile: (data: { displayName?: string; photoURL?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  signup: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
  updateProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    return loginWithEmail(email, password);
  };

  const signup = async (email: string, password: string, displayName: string) => {
    const userCredential = await signupWithEmail(email, password);
    
    // Update profile with display name
    if (userCredential.user) {
      await updateUserProfile(userCredential.user, { displayName });
    }
    
    return userCredential;
  };

  const logout = async () => {
    return firebaseLogout();
  };

  const updateProfile = async (data: { displayName?: string; photoURL?: string }) => {
    if (user) {
      await updateUserProfile(user, data);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      signup, 
      loginWithGoogle, 
      logout,
      updateProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
