"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  const { wordBooks, loading } = useVocab();
  const showSidebar = pathname !== "/word-books/overview";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8.5rem)] w-full max-w-7xl">
      {showSidebar ? (
        <aside className="hidden w-52 shrink-0 border-r border-taupe/30 py-14 pl-6 pr-3 lg:block">
          <p className="mb-2 px-2.5 text-[11px] font-medium uppercase tracking-wider text-ink/35">
            단어장
          </p>

          <nav className="space-y-0.5">
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
        </aside>
      ) : null}

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
