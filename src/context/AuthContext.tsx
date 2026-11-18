import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  onIdTokenChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

export interface AuthProfile {
  uid: string;
  email: string;
  name?: string;
  role: 'admin' | 'operator' | 'viewer';
  tenantId: string;
}

interface AuthContextValue {
  user: User | null;
  idToken: string | null;
  authProfile: AuthProfile | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<string | null>;
  signOutUser: () => Promise<void>;
  getFreshToken: () => Promise<string | null>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [authProfile, setAuthProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const syncServerProfile = useCallback(async (token: string | null) => {
    if (!token) {
      setAuthProfile(null);
      return;
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          setAuthProfile(data.user);
        }
      }
    } catch {
      // Leave authProfile unset on transient error
    }
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          setIdToken(token);
          await syncServerProfile(token);
        } catch {
          setIdToken(null);
          setAuthProfile(null);
        }
      } else {
        setIdToken(null);
        setAuthProfile(null);
      }
      setLoading(false);
    });

    const unsubToken = onIdTokenChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          setIdToken(token);
        } catch {
          setIdToken(null);
        }
      } else {
        setIdToken(null);
        setAuthProfile(null);
      }
    });

    return () => {
      unsubAuth();
      unsubToken();
    };
  }, [syncServerProfile]);

  const signInWithGoogle = useCallback(async (): Promise<string | null> => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const token = await cred.user.getIdToken();
      setUser(cred.user);
      setIdToken(token);
      await syncServerProfile(token);
      return token;
    } catch (err: any) {
      setAuthError(err?.message || 'Google Sign-In failed');
      return null;
    }
  }, [syncServerProfile]);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    await signOut(auth);
    setUser(null);
    setIdToken(null);
    setAuthProfile(null);
  }, []);

  const getFreshToken = useCallback(async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    try {
      const token = await auth.currentUser.getIdToken();
      setIdToken(token);
      return token;
    } catch {
      return idToken;
    }
  }, [idToken]);

  const refreshProfile = useCallback(async () => {
    const token = await getFreshToken();
    await syncServerProfile(token);
  }, [getFreshToken, syncServerProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        idToken,
        authProfile,
        loading,
        authError,
        signInWithGoogle,
        signOutUser,
        getFreshToken,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
