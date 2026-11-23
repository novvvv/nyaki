import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const requiredValues = Object.values(firebaseConfig);

export const firebaseEnabled = requiredValues.every(
  (value) => typeof value === "string" && value.length > 0,
);

const app = firebaseEnabled
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : undefined;

export const firebaseAuth = app ? getAuth(app) : undefined;
export const googleProvider = new GoogleAuthProvider();
// 구글에 로그인된 계정으로 바로 들어가지 않고, 매번 계정을 고르게 한다(계정 전환).
googleProvider.setCustomParameters({ prompt: "select_account" });
