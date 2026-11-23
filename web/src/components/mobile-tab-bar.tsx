"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { isActive, navItems } from "@/components/site-header";
import { useAppMode } from "@/lib/app-mode";
import { cn } from "@/lib/utils";

/** 탭 아이콘 — 흑백 선 그림. 고른 탭만 안을 분홍으로 채운다. */
const ICONS: Record<string, ReactNode> = {
  "/today": (
    <>
      <path d="M4 10.5 12 4l8 6.5V20H4z" />
      <path d="M9.5 20v-5.5h5V20" fill="none" />
    </>
  ),
  "/word-books": (
    <>
      <path d="M5 4.5h11a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z" />
      <path d="M5 17a3 3 0 0 1 3-3h11" fill="none" />
    </>
  ),
  "/review": (
    <>
      <rect x="7" y="3.5" width="12" height="15.5" rx="2.5" />
      <path d="M4.5 7v11.5A2.5 2.5 0 0 0 7 21h8.5" fill="none" />
    </>
  ),
  "/word-books/overview": (
    <>
      <rect x="4" y="12" width="4" height="8" rx="1.2" />
      <rect x="10" y="7" width="4" height="13" rx="1.2" />
      <rect x="16" y="4" width="4" height="16" rx="1.2" />
    </>
  ),
  "/downloads": (
    <>
      <path d="M5 9.5h14l-1.2 10.5H6.2z" />
      <path d="M9 9.5V7a3 3 0 0 1 6 0v2.5" fill="none" />
    </>
  ),
  "/my": (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5z" />
    </>
  ),
};

interface Tab {
  href: string;
  /** 탭 바의 짧은 이름 */
  label: string;
}

/** 폰 브라우저 — 위쪽 메뉴 줄과 같은 곳으로 간다. */
const WEB_TABS: Tab[] = navItems.map((item) => ({
  href: item.href,
  label: {
    "/word-books": "단어장",
    "/review": "테스트",
    "/word-books/overview": "통계",
    "/downloads": "다운로드",
    "/my": "마이",
  }[item.href],
}));

/** 앱 — 오늘 화면이 첫 탭이다. 단어 다운로드는 오늘 화면에서 들어간다. */
const APP_TABS: Tab[] = [
  { href: "/today", label: "오늘" },
  { href: "/word-books", label: "단어장" },
  { href: "/review", label: "테스트" },
  { href: "/word-books/overview", label: "통계" },
  { href: "/my", label: "마이" },
];

/** 앱 탭 바의 첫 화면인가 — 아니면 위 바에 뒤로 가기를 단다. */
export function isAppTabRoot(pathname: string): boolean {
  return APP_TABS.some((tab) => tab.href === pathname);
}

/** 지금 화면이 속한 앱 탭 — 앱 위 바의 뒤로 가기가 갈 곳이 없을 때 이리로 간다. */
export function appTabFor(pathname: string): Tab | undefined {
  return APP_TABS.find((tab) =>
    tab.href === "/today"
      ? pathname === "/today"
      : isActive(pathname, tab.href),
  );
}

/**
 * 아래 탭 바 — 폰 크기 화면과 앱 모드. 넓은 화면 웹(md 이상)에서는 숨는다.
 * 앱 모드에서는 폭과 상관없이 보인다(globals.css .app .tab-bar).
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const appMode = useAppMode();
  // 로그인 화면은 탭 없이 — 어디로도 갈 수 없는 상태다.
  if (pathname === "/login") return null;
  const tabs = appMode ? APP_TABS : WEB_TABS;
  const current = tabs.find((tab) =>
    tab.href === "/today"
      ? pathname === "/today"
      : isActive(pathname, tab.href),
  );

  return (
    <nav
      aria-label="주요 메뉴"
      className="tab-bar fixed inset-x-0 bottom-0 z-30 border-t border-taupe/50 bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {tabs.map((tab) => {
          const on = current?.href === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] transition",
                on ? "font-semibold text-ink" : "text-ink/40",
              )}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinejoin="round"
                strokeLinecap="round"
                className={cn(
                  "size-6",
                  on ? "fill-[#efd6d6] dark:fill-[#efd6d6]/30" : "fill-none",
                )}
              >
                {ICONS[tab.href]}
              </svg>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
