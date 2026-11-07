import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, db } from '../config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '../errorHandler';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'driver' | 'admin';
  createdAt?: string;
  lastLoginAt?: string;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  authReady: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  isAdmin: false,
  authReady: false,
  loginWithGoogle: async () => {},
  logout: async () => {},
});

const ADMIN_EMAILS = ['maxborba71@gmail.com'];

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [authReady, setAuthReady] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const isUserAdminEmail = ADMIN_EMAILS.includes(user.email || '');
        const role = isUserAdminEmail ? 'admin' : 'driver';
        setIsAdmin(isUserAdminEmail);

        const profile: UserProfile = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role,
          lastLoginAt: new Date().toISOString(),
        };
        setUserProfile(profile);

        // Sync or update profile in Firestore
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const snap = await getDoc(userDocRef);
          if (!snap.exists()) {
            await setDoc(userDocRef, {
              ...profile,
              createdAt: new Date().toISOString(),
            });
          } else {
            await setDoc(userDocRef, { ...profile }, { merge: true });
          }
        } catch (err) {
          console.warn('Could not sync user profile to Firestore:', err);
        }
      } else {
        setUserProfile(null);
        setIsAdmin(false);
      }
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        console.error('Erro ao efetuar login com Google:', err);
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Erro ao deslogar:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        isAdmin,
        authReady,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
