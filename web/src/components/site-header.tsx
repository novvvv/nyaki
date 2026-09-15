"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/auth-provider";

const navItems = [
  { href: "/word-books", label: "내 단어장" },
  { href: "/review", label: "테스트" },
  { href: "/word-books/overview", label: "전체 통계" },
  { href: "/downloads", label: "단어 다운로드" },
  { href: "/my", label: "마이페이지" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/word-books") {
    return pathname === href || /^\/word-books\/(?!overview)/.test(pathname);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AccountArea() {
  const { user, signIn, signOutUser } = useAuth();

  async function handleSignIn() {
    try {
      await signIn();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "로그인에 실패했어요.",
      );
    }
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => void handleSignIn()}
        className="text-xs text-ink/45 transition hover:text-ink"
      >
        로그인
      </button>
    );
  }

  return (
    <>
      <span className="hidden max-w-[180px] truncate text-xs text-ink/35 sm:block">
        {user.displayName ?? user.email}
      </span>
      <button
        type="button"
        onClick={() => void signOutUser()}
        className="text-xs text-ink/45 transition hover:text-ink"
      >
        로그아웃
      </button>
    </>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const current = navItems.find((item) => isActive(pathname, item.href));

  return (
    <header className="sticky top-0 z-20 bg-cream">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          aria-label="Nyaki 홈"
          className="text-sm font-semibold tracking-tight text-ink"
        >
          /ᐠ. ᴗ.ᐟ\
        </Link>

        <div className="flex items-center gap-4">
          <AccountArea />
        </div>
      </div>

      <nav className="overflow-x-auto border-y border-taupe/50 bg-card">
        <div className="mx-auto flex w-max min-w-full max-w-7xl items-center justify-center px-6">
          {navItems.map((item, index) => (
            <div key={item.href} className="flex items-center">
              {index > 0 ? (
                <span className="h-3 w-px shrink-0 bg-taupe" aria-hidden />
              ) : null}
              <Link
                href={item.href}
                aria-current={current?.href === item.href ? "page" : undefined}
                className={`whitespace-nowrap px-5 py-3.5 text-sm transition ${
                  current?.href === item.href
                    ? "font-medium text-ink"
                    : "text-ink/60 hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            </div>
          ))}
        </div>
      </nav>
    </header>
  );
}
