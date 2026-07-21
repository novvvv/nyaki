"use client";

import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { PrimaryButton } from "@/components/ui";

function LandingScreen({
  message,
  children,
}: {
  message?: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-8">
      <div className="flex w-full max-w-[340px] flex-col items-center text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink/35">
          Vocabulary, calmly
        </p>
        <h1 className="mt-2.5 text-[2.5rem] font-semibold tracking-[-0.02em] text-ink sm:text-5xl">
          Nyaki
        </h1>
        <p className="mt-3 text-[15px] leading-[1.65] text-ink/45">
          폰과 웹에서 같은 단어장을
          <br />
          외우고, 기록하고, 어디서든 이어서.
        </p>

        <p className="mt-7 text-[15px] font-medium leading-relaxed text-ink/60">
          궁금한 거 있으면 언제든지 물어보라냥
        </p>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cat.png"
          alt="Nyaki 고양이"
          width={500}
          height={500}
          className="mt-4 block h-auto w-[min(260px,68vw)]"
        />

        {message ? (
          <p className="mt-5 text-sm text-ink/40">{message}</p>
        ) : null}
        {children ? <div className="mt-7 w-full">{children}</div> : null}

        <p className="mt-6 text-[11px] text-ink/30">
          모바일 앱과 실시간 동기화
        </p>
      </div>
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
    return (
      <LandingScreen message="로그인 상태를 확인하고 있습니다." />
    );
  }

  if (!configured) {
    return (
      <LandingScreen message="NEXT_PUBLIC_FIREBASE_* 환경 변수를 설정해 주세요." />
    );
  }

  if (!user) {
    return (
      <LandingScreen>
        <PrimaryButton
          className="h-11 w-full text-[15px]"
          disabled={signingIn}
          onClick={() => void handleSignIn()}
        >
          {signingIn ? "로그인 중…" : "Google로 계속하기"}
        </PrimaryButton>
      </LandingScreen>
    );
  }

  return <AppShell>{children}</AppShell>;
}
