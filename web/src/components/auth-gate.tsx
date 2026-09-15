"use client";

import { useState } from "react";

import { useAuth } from "@/components/auth-provider";
// import { PricingSection } from "@/components/pricing-section"; // 플랜 섹션 일단 주석처리

function LandingScreen({
  message,
  children,
}: {
  message?: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-[calc(100vh-8.5rem)] flex-col items-center justify-center px-6 py-16 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/cat.png"
        alt="Nyaki 고양이"
        width={500}
        height={500}
        className="block h-auto w-[min(260px,68vw)]"
      />

      {message ? <p className="mt-8 text-sm text-ink/40">{message}</p> : null}
      {children ? <div className="mt-8">{children}</div> : null}

      {/* <PricingSection /> 플랜 섹션 일단 주석처리 */}
    </main>
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, user, configured, signIn } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  async function handleSignIn() {
    if (signingIn) return;
    setSigningIn(true);
    try {
      await signIn();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "로그인에 실패했어요.";
      window.alert(message);
    } finally {
      setSigningIn(false);
    }
  }

  if (!ready) {
    return <LandingScreen message="로그인 상태를 확인하고 있습니다." />;
  }

  if (!configured) {
    return (
      <LandingScreen message="NEXT_PUBLIC_FIREBASE_* 환경 변수를 설정해 주세요." />
    );
  }

  if (!user) {
    return (
      <LandingScreen>
        <button
          type="button"
          disabled={signingIn}
          onClick={() => void handleSignIn()}
          className="text-sm text-ink/40 transition hover:text-ink/70 disabled:opacity-45"
        >
          {signingIn ? "로그인 중…" : "Google로 계속하기"}
        </button>
      </LandingScreen>
    );
  }

  return <>{children}</>;
}
