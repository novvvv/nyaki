"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { useNyakiImage } from "@/lib/nyaki-skin";
// import { PricingSection } from "@/components/pricing-section"; // 플랜 섹션 일단 주석처리

function LandingScreen({
  message,
  children,
}: {
  message?: string;
  children?: React.ReactNode;
}) {
  const nyaki = useNyakiImage();
  return (
    <main className="flex min-h-[calc(100vh-8.5rem)] flex-col items-center justify-center px-6 py-16 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={nyaki("normal")}
        alt="Nyaki"
        width={1792}
        height={2400}
        className="block h-auto w-[min(320px,72vw)]"
      />

      {message ? <p className="mt-8 text-sm text-ink/40">{message}</p> : null}
      {children ? <div className="mt-8">{children}</div> : null}

      {/* <PricingSection /> 플랜 섹션 일단 주석처리 */}
    </main>
  );
}

export function isPublicPath(pathname: string): boolean {
  // 메인은 소개(랜딩)라 누구나 본다. 무엇인지 알아야 가입한다.
  if (pathname === "/") return true;
  // 약관 · 방침은 가입 전에 읽을 수 있어야 한다.
  if (pathname === "/terms" || pathname === "/privacy") return true;
  // 요금제는 가입 전에 보고 고른다.
  if (pathname === "/pricing") return true;
  return pathname === "/downloads" || /^\/downloads\/[^/]+$/.test(pathname);
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, user, configured } = useAuth();
  const pathname = usePathname();

  // 로그인 화면은 문 안쪽이 아니다 — 여기서 막으면 로그인하러 갈 수가 없다.
  if (pathname === "/login") return <>{children}</>;
  // 단어 다운로드 목록과 묶음 상세는 누구나 본다. 가입 전에 무엇이 있는지
  // 둘러볼 수 있어야 한다. 담기 화면(/downloads/[id]/save)은 내 단어장을
  // 건드리니 여전히 로그인이 필요하다.
  if (isPublicPath(pathname)) return <>{children}</>;

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
