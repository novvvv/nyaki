"use client";

import { FirebaseError } from "firebase/app";
import Link from "next/link";
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
      <div className="flex w-full max-w-3xl flex-col items-center gap-8 break-keep sm:flex-row sm:items-center sm:gap-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/nyaki_normal.webp"
          alt="Nyaki"
          width={1792}
          height={2400}
          className="block h-auto w-[min(200px,52vw)] shrink-0 sm:w-[260px]"
        />

        <div className="w-full max-w-sm rounded-2xl border border-taupe/40 bg-card px-6 py-8 text-left sm:px-8">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            냐키 시작하기
          </h1>
          <p className="mt-1.5 text-sm text-ink/55">
            로그인하면 내 단어장과 복습 기록이 저장돼요.
          </p>

          <ul className="mt-6 space-y-2.5 text-sm text-ink/70">
            {BENEFITS.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckMark />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          {configured ? (
            <button
              type="button"
              disabled={signingIn}
              onClick={() => void handleSignIn()}
              className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-lg border border-taupe/60 bg-white px-5 py-3 text-sm font-medium text-neutral-800 shadow-sm transition hover:border-taupe hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <GoogleMark />
              {signingIn ? "로그인 중…" : "Google로 계속하기"}
            </button>
          ) : (
            <p className="mt-7 text-sm text-ink/40">
              NEXT_PUBLIC_FIREBASE_* 환경 변수를 설정해 주세요.
            </p>
          )}

          {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

          <p className="mt-5 text-xs leading-relaxed text-ink/45">
            비밀번호는 받지 않아요. Google 계정으로 본인 확인만 하고, 단어장과
            복습 기록 외의 정보는 저장하지 않아요.
          </p>
          <p className="mt-3 border-t border-taupe/30 pt-3 text-xs leading-relaxed text-ink/45">
            계속하면 냐키의{" "}
            <Link href="/terms" className={LEGAL_LINK}>
              이용약관
            </Link>
            과{" "}
            <Link href="/privacy" className={LEGAL_LINK}>
              개인정보처리방침
            </Link>
            에 동의하는 것으로 봐요.
          </p>
        </div>
      </div>
    </main>
  );
}

const LEGAL_LINK =
  "text-ink/70 underline decoration-taupe/60 underline-offset-2 transition hover:text-ink";

const BENEFITS = [
  "‘모름 / 외움’만 고르면 복습일은 냐키가 정해요",
  "내 단어장을 만들고 어느 기기에서나 이어서 외워요",
  "언제든 마이페이지에서 탈퇴하고 모든 기록을 지울 수 있어요",
];

function CheckMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 size-4 shrink-0 text-ink/60"
    >
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
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
