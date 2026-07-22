"use client";

import Link from "next/link";

import { GhostButton } from "@/components/ui";

const links = [{ href: "#plans", label: "구독" }] as const;

export function HomeNav({ onSignOut }: { onSignOut?: () => void }) {
  return (
    <header className="sticky top-0 z-10 border-b border-ink/[0.06] bg-cream/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-center gap-5 px-6 sm:gap-8">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-ink"
        >
          Nyaki
        </Link>

        <span className="h-3 w-px bg-ink/10" aria-hidden />

        <nav className="flex items-center gap-4 sm:gap-5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-ink/45 transition hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
          {onSignOut ? (
            <GhostButton
              className="px-0 py-0 text-sm text-ink/30 hover:bg-transparent hover:text-ink/55"
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
