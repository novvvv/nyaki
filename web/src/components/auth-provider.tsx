"use client";

import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
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
  /** 이메일 로그인. 구글 계정이 없거나 쓰기 싫은 사람을 위한 길이다. */
  signInWithEmail: (email: string, password: string) => Promise<void>;
  /** 이메일 회원가입. 이름은 비워두면 이메일 앞부분을 쓴다. */
  signUpWithEmail: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
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

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!firebaseAuth) {
        throw new Error("Firebase Web 환경 변수가 설정되지 않았습니다.");
      }
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    },
    [],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      if (!firebaseAuth) {
        throw new Error("Firebase Web 환경 변수가 설정되지 않았습니다.");
      }
      const credential = await createUserWithEmailAndPassword(
        firebaseAuth,
        email.trim(),
        password,
      );

      // 이름이 없으면 이메일 앞부분을 쓴다 — 마이페이지에 "이름 없음"만
      // 뜨는 것보다 낫다.
      const name = displayName?.trim() || email.trim().split("@")[0];
      if (name) await updateProfile(credential.user, { displayName: name });
    },
    [],
  );

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
      signInWithEmail,
      signUpWithEmail,
      signOutUser,
      getToken,
    }),
    [
      user,
      ready,
      signIn,
      signInWithEmail,
      signUpWithEmail,
      signOutUser,
      getToken,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
