"use client";

import Link from "next/link";

import { GhostButton } from "@/components/ui";

const links = [{ href: "#plans", label: "구독" }] as const;

export function HomeNav({ onSignOut }: { onSignOut?: () => void }) {
  return (
    <header className="sticky top-0 z-10 border-b border-taupe/35 bg-cream/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-center gap-5 px-6 sm:gap-8">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-ink"
        >
          Nyaki
        </Link>

        <span className="h-3 w-px bg-taupe/70" aria-hidden />

        <nav className="flex items-center gap-4 sm:gap-5">
          <Link
            href="/word-books"
            className="text-sm text-umber/55 transition hover:text-ink"
          >
            내 단어장
          </Link>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-umber/55 transition hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
          {onSignOut ? (
            <GhostButton
              className="px-0 py-0 text-sm text-umber/40 hover:bg-transparent hover:text-ink/70"
              onClick={onSignOut}
            >
              로그아웃
            </GhostButton>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
