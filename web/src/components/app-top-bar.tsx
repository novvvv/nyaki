"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { appTabFor, isAppTabRoot } from "@/components/mobile-tab-bar";
import { fetchDueCounts } from "@/lib/api-client";
import { useAppMode } from "@/lib/app-mode";

/** 오늘 복습할 카드 수. 화면을 옮길 때마다 다시 센다(서버는 COUNT만 한다). */
function useDueTotal(): number | null {
  const { user, getToken } = useAuth();
  const pathname = usePathname();
  const appMode = useAppMode();
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    if (!appMode || !user) return;
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const counts = await fetchDueCounts(token);
        if (!cancelled) setTotal(counts.total);
      } catch {
        // 숫자 하나 때문에 막지 않는다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appMode, user, getToken, pathname]);

  return user ? total : null;
}

/**
 * 앱 모드의 위 바 — 탭 첫 화면이면 냐키, 안쪽 화면이면 뒤로 가기. 오른쪽에 오늘 복습 수.
 * 오늘 화면은 자기 인사말 머리가 있어서 이 바를 쓰지 않는다.
 */
export function AppTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const due = useDueTotal();

  if (pathname === "/today" || pathname === "/login") return null;
  const tab = appTabFor(pathname);
  // 탭 첫 화면이 아니면(단어장 안, 단어 다운로드 등) 뒤로 갈 길을 준다.
  const nested = !isAppTabRoot(pathname);

  return (
    <header className="app-only sticky top-0 z-20 border-b border-taupe/40 bg-cream/95 backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-4">
        {nested ? (
          <button
            type="button"
            // 이 화면에서 앱을 열었으면 돌아갈 곳이 없다 — 탭 첫 화면으로.
            onClick={() =>
              window.history.length > 1
                ? router.back()
                : router.push(tab?.href ?? "/today")
            }
            aria-label="뒤로"
            className="-ml-1 grid size-9 place-items-center rounded-full text-ink transition hover:bg-subtle"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        ) : (
          <Link href="/today" aria-label="오늘" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-192.png"
              alt=""
              width={192}
              height={192}
              className="size-8 rounded-full ring-1 ring-ink/10"
            />
          </Link>
        )}

        {/* 화면 제목은 본문 머리(PageHeader)가 크게 보여 준다 — 여기서 또 쓰지 않는다. */}
        <p className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-tight text-ink">
          {nested ? "" : "Nyaki"}
        </p>

        {due !== null ? (
          <Link
            href="/review"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ink/40"
          >
            <span
              aria-hidden
              className={
                due > 0
                  ? "size-2 rounded-full bg-[#e3a9a9]"
                  : "size-2 rounded-full bg-ink/20"
              }
            />
            {due > 0 ? `복습 ${due}` : "복습 끝"}
          </Link>
        ) : null}
      </div>
    </header>
  );
}
