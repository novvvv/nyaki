"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  const { ready, user, configured } = useAuth();
  const pathname = usePathname();

  // 로그인 화면은 문 안쪽이 아니다 — 여기서 막으면 로그인하러 갈 수가 없다.
  if (pathname === "/login") return <>{children}</>;

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
        {/* 팝업을 바로 띄우지 않는다 — 로그인 화면에 이메일 가입도 있다. */}
        <Link
          href={`/login?next=${encodeURIComponent(pathname)}`}
          className="text-sm text-ink/40 transition hover:text-ink/70"
        >
          로그인
        </Link>
      </LandingScreen>
    );
  }

  return <>{children}</>;
}
