"use client";

import { FirebaseError } from "firebase/app";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { safeNext } from "@/lib/safe-next";

// << ? 
const SCREEN =
  "flex min-h-[calc(100vh-8.5rem)] flex-col items-center justify-center px-6 py-16 text-center";

/* Firebase 오류 코드를 사람이 읽을 문구로. 서비스 톤에 맞춘다. */
function messageFor(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/popup-blocked":
        return "브라우저가 로그인 창을 막았다냥. 팝업을 허용하고 다시 눌러 달라냥";
      case "auth/network-request-failed":
        return "인터넷 연결이 불안한 것 같다냥. 잠시 뒤에 다시 눌러 달라냥";
      case "auth/unauthorized-domain":
        return "이 주소에서는 아직 로그인할 수 없다냥";
      default:
        return "로그인이 잘 안 됐다냥. 다시 한 번 눌러 달라냥";
    }
  }
  return error instanceof Error
    ? error.message
    : "로그인이 잘 안 됐다냥. 다시 한 번 눌러 달라냥";
}

function LoginScreen() {
  const { ready, user, configured, signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string>();

  // 이미 로그인한 채로 들어오면 붙잡아두지 않는다.
  useEffect(() => {
    if (ready && user) router.replace(next);
  }, [ready, user, next, router]);

  async function handleSignIn() {
    if (signingIn) return;
    setSigningIn(true);
    setError(undefined);
    try {
      await signIn();
      // 로그인이 끝나도 onAuthStateChanged가 돌기 전이다.
      // 위 useEffect가 user를 받는 순간 next로 보낸다.
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <main className={SCREEN}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/cat.png"
        alt="Nyaki 고양이"
        width={500}
        height={500}
        className="block h-auto w-[min(220px,58vw)]"
      />

      {configured ? (
        <button
          type="button"
          disabled={signingIn}
          onClick={() => void handleSignIn()}
          className="mt-8 text-sm text-ink/40 transition hover:text-ink/70 disabled:opacity-45"
        >
          {signingIn ? "로그인 중…" : "Google로 계속하기"}
        </button>
      ) : (
        <p className="mt-8 text-sm text-ink/40">
          NEXT_PUBLIC_FIREBASE_* 환경 변수를 설정해 주세요.
        </p>
      )}

      {error ? <p className="mt-6 text-sm text-red-700">{error}</p> : null}
    </main>
  );
}

export default function LoginPage() {
  // useSearchParams는 정적 프리렌더 중에 값을 알 수 없어 Suspense가 필요하다.
  return (
    <Suspense fallback={<main className={SCREEN} />}>
      <LoginScreen />
    </Suspense>
  );
}
