"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { BookTile, type TodayBook } from "@/components/today-view";
import { fetchDueCounts } from "@/lib/api-client";
import type { WordBook } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useVocab } from "@/lib/vocab-store";

/** 단어장별 오늘 복습 수. 못 받으면 빈 값 — 배지만 안 보인다. */
function useDueByBook(): Record<string, number> {
  const { getToken } = useAuth();
  const [byBook, setByBook] = useState<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const counts = await fetchDueCounts(token);
        if (!cancelled) setByBook(counts.byBook);
      } catch {
        // 배지 없이 보여 준다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);
  return byBook;
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn(
        "size-5 shrink-0",
        open ? "fill-[#efd6d6] dark:fill-[#efd6d6]/30" : "fill-none",
      )}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
    >
      <path d="M3.5 7a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function BookGrid({ books }: { books: TodayBook[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {books.map((book) => (
        <BookTile key={book.id} book={book} />
      ))}
    </div>
  );
}

/**
 * 앱의 단어장 탭 — 폴더마다 단어장을 타일로 늘어놓는다. 타일은 오늘 화면과 같다
 * (복습 수 · 단어 수 · 암기율). 웹 목록(app/word-books/page.tsx)과 같은 데이터다.
 */
export function AppWordBooks() {
  const { wordBooks, folders, summaries, loading, error } = useVocab();
  const dueByBook = useDueByBook();
  const [collapsed, setCollapsed] = useState<string[]>([]);

  const tile = (book: WordBook): TodayBook => ({
    id: book.id,
    title: book.title,
    items: summaries[book.id]?.itemCount ?? 0,
    mastery: summaries[book.id]?.masteryRate ?? 0,
    due: dueByBook[book.id] ?? 0,
  });

  // 폴더 id가 남아 있는데 폴더를 못 찾으면(동기화 중 등) 밖으로 보여 준다 — 웹과 같다.
  const folderIds = new Set(folders.map((folder) => folder.id));
  const loose = wordBooks.filter(
    (book) => !book.folderId || !folderIds.has(book.folderId),
  );
  const totalItems = wordBooks.reduce(
    (sum, book) => sum + (summaries[book.id]?.itemCount ?? 0),
    0,
  );
  const totalDue = Object.values(dueByBook).reduce((a, b) => a + b, 0);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 pb-10 pt-5 break-keep">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-ink">
            내 단어장
          </h1>
          <p className="mt-1 text-xs text-ink/45 tabular-nums">
            단어장 {wordBooks.length}개 · 항목 {totalItems}개
            {totalDue > 0 ? ` · 복습 ${totalDue}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Link
            href="/word-books/folders/new"
            className="rounded-full border border-ink/20 px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ink/50"
          >
            + 폴더
          </Link>
          <Link
            href="/word-books/new"
            className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-cream transition hover:bg-ink/85"
          >
            + 단어장
          </Link>
        </div>
      </header>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-ink/40">불러오는 중…</p>
      ) : wordBooks.length === 0 ? (
        <Link
          href="/word-books/new"
          className="flex min-h-[140px] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-ink/20 text-sm text-ink/45 transition hover:border-ink/40 hover:text-ink"
        >
          <span className="text-2xl leading-none">+</span>첫 단어장 만들기
        </Link>
      ) : (
        <>
          {folders.map((folder) => {
            const books = wordBooks.filter(
              (book) => book.folderId === folder.id,
            );
            const open = !collapsed.includes(folder.id);
            return (
              <section key={folder.id}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() =>
                    setCollapsed((prev) =>
                      open
                        ? [...prev, folder.id]
                        : prev.filter((id) => id !== folder.id),
                    )
                  }
                  className="mb-3 flex w-full items-center gap-2 text-left text-ink"
                >
                  <FolderIcon open={open} />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                    {folder.title}
                  </span>
                  <span className="shrink-0 text-xs text-ink/40 tabular-nums">
                    {books.length}개
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0 text-ink/40 transition",
                      open && "rotate-180",
                    )}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {open ? (
                  books.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-ink/15 py-5 text-center text-xs text-ink/35">
                      비어 있음
                    </p>
                  ) : (
                    <BookGrid books={books.map(tile)} />
                  )
                ) : null}
              </section>
            );
          })}

          {loose.length > 0 ? (
            <section>
              {folders.length > 0 ? (
                <h2 className="mb-3 text-[15px] font-semibold text-ink">
                  폴더 밖 단어장
                </h2>
              ) : null}
              <BookGrid books={loose.map(tile)} />
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
