"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { GhostButton } from "@/components/ui";
import { bookMeta, useVocab } from "@/lib/vocab-store";

function SidebarItem({
  href,
  label,
  meta,
  active,
}: {
  href: string;
  label: string;
  meta?: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition ${
        active
          ? "bg-subtle font-medium text-ink"
          : "text-umber/65 hover:bg-subtle/70 hover:text-ink"
      }`}
    >
      <span className="truncate">{label}</span>
      {meta ? <span className="ml-2 shrink-0 text-xs text-ink/35">{meta}</span> : null}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { signOutUser } = useAuth();
  const { wordBooks, loading } = useVocab();

  return (
    <div className="flex min-h-full">
      <aside className="fixed inset-y-0 left-0 flex w-56 flex-col border-r border-taupe/30 bg-cream px-3 py-4">
        <Link
          href="/"
          className="mb-4 px-2.5 text-sm font-semibold tracking-tight text-ink"
        >
          Nyaki
        </Link>

        <nav className="mb-3">
          <SidebarItem
            href="/word-books"
            label="전체 단어장"
            active={pathname === "/word-books"}
          />
        </nav>

        <p className="mb-2 px-2.5 text-[11px] font-medium uppercase tracking-wider text-ink/35">
          단어장
        </p>

        <nav className="flex-1 space-y-0.5 overflow-y-auto">
          {loading ? (
            <p className="px-2.5 py-1.5 text-xs text-ink/35">불러오는 중…</p>
          ) : wordBooks.length === 0 ? (
            <p className="px-2.5 py-1.5 text-xs text-ink/35">비어 있음</p>
          ) : (
            wordBooks.map((book) => {
              const href = `/word-books/${book.id}`;
              const meta = bookMeta(book);
              return (
                <SidebarItem
                  key={book.id}
                  href={href}
                  label={book.title}
                  meta={`${meta.count}`}
                  active={pathname === href || pathname.startsWith(`${href}/`)}
                />
              );
            })
          )}
        </nav>

        <div className="mt-3 border-t border-taupe/30 pt-3">
          <GhostButton
            className="w-full justify-start px-2.5 text-ink/40"
            onClick={() => void signOutUser()}
          >
            로그아웃
          </GhostButton>
        </div>
      </aside>

      <div className="ml-56 min-h-full flex-1">{children}</div>
    </div>
  );
}
