"use client";

import { FirebaseError } from "firebase/app";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { safeNext } from "@/lib/safe-next";

// 헤더·푸터를 뺀 높이만큼만 써서 화면 한가운데에 둔다.
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
      case "auth/too-many-requests":
        return "잠시 뒤에 다시 시도해 달라냥";
      default:
        return "로그인이 잘 안 됐다냥. 다시 한 번 눌러 달라냥";
    }
  }
  return error instanceof Error
    ? error.message
    : "로그인이 잘 안 됐다냥. 다시 한 번 눌러 달라냥";
}

/**
 * 로그인 화면. 방법은 구글 하나다.
 *
 * 이메일·비밀번호도 만들어봤지만 걷어냈다. 비밀번호를 직접 받으면 그 순간
 * 개인정보처리자가 되고, 같은 주소로 두 방법을 쓸 때 "이미 가입된 이메일"과
 * "비밀번호가 틀렸다" 사이에 갇히는 막다른 길이 생긴다. Firebase는 이메일 열거
 * 방지 때문에 그 주소가 어느 방법으로 가입됐는지도 알려주지 않아 안내할 수 없다.
 */
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
          className="mt-10 inline-flex items-center gap-2.5 rounded-lg border border-taupe/45 px-5 py-2.5 text-sm text-ink transition hover:border-taupe/80 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <GoogleMark />
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

/** 구글 로고. 색은 구글 브랜드 가이드 값이다. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden className="size-4 shrink-0">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
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
