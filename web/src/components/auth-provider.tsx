"use client";

import { FirebaseError } from "firebase/app";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { firebaseAuth, firebaseEnabled, googleProvider } from "@/lib/firebase";

function isBenignAuthError(error: unknown) {
  return (
    error instanceof FirebaseError &&
    (error.code === "auth/cancelled-popup-request" ||
      error.code === "auth/popup-closed-by-user")
  );
}

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  configured: boolean;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!firebaseEnabled);
  const signInInProgress = useRef(false);

  useEffect(() => {
    if (!firebaseAuth) return;
    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setReady(true);
    });
  }, []);

  const signIn = useCallback(async () => {
    if (!firebaseAuth) {
      throw new Error("Firebase Web 환경 변수가 설정되지 않았습니다.");
    }
    if (signInInProgress.current) return;

    signInInProgress.current = true;
    try {
      await signInWithPopup(firebaseAuth, googleProvider);
    } catch (error) {
      if (isBenignAuthError(error)) return;
      throw error;
    } finally {
      signInInProgress.current = false;
    }
  }, []);

  const signOutUser = useCallback(async () => {
    if (firebaseAuth) await signOut(firebaseAuth);
  }, []);

  const getToken = useCallback(async () => user?.getIdToken() ?? null, [user]);

  const value = useMemo(
    () => ({
      user,
      ready,
      configured: firebaseEnabled,
      signIn,
      signOutUser,
      getToken,
    }),
    [user, ready, signIn, signOutUser, getToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
