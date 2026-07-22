"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { GhostButton, PrimaryButton, TextInput } from "@/components/ui";
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
          : "text-ink/60 hover:bg-subtle hover:text-ink"
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
  const { wordBooks, createWordBook, loading } = useVocab();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title) return;
    try {
      await createWordBook({ title });
      setNewTitle("");
      setCreating(false);
    } catch (reason) {
      window.alert(
        reason instanceof Error ? reason.message : "단어장을 만들지 못했어요.",
      );
    }
  }

  return (
    <div className="flex min-h-full">
      <aside className="fixed inset-y-0 left-0 flex w-56 flex-col border-r border-ink/[0.06] bg-cream px-3 py-4">
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

        <div className="mt-3 space-y-2 border-t border-ink/[0.06] pt-3">
          {creating ? (
            <div className="space-y-2 px-1">
              <TextInput
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="이름"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreate();
                  if (e.key === "Escape") setCreating(false);
                }}
              />
              <div className="flex gap-1">
                <PrimaryButton
                  className="flex-1 py-1.5 text-xs"
                  disabled={!newTitle.trim()}
                  onClick={() => void handleCreate()}
                >
                  만들기
                </PrimaryButton>
                <GhostButton
                  className="py-1.5 text-xs"
                  onClick={() => setCreating(false)}
                >
                  취소
                </GhostButton>
              </div>
            </div>
          ) : (
            <GhostButton
              className="w-full justify-start px-2.5 text-ink/50"
              onClick={() => setCreating(true)}
            >
              + 새 단어장
            </GhostButton>
          )}
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
