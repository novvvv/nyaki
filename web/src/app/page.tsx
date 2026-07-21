"use client";

import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/ui";
import { bookMeta, useVocab } from "@/lib/vocab-store";

export default function HomePage() {
  const { wordBooks, loading, error } = useVocab();

  return (
    <main className="mx-auto max-w-2xl px-8 py-10">
      <PageHeader
        title="단어장"
        description="모바일과 동기화되는 단어장을 관리합니다."
      />

      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-ink/40">불러오는 중…</p>
      ) : wordBooks.length === 0 ? (
        <EmptyState
          title="단어장이 없습니다"
          description="왼쪽 사이드바에서 새 단어장을 만들어 보세요."
        />
      ) : (
        <div className="divide-y divide-ink/[0.06]">
          {wordBooks.map((book) => {
            const meta = bookMeta(book);
            return (
              <Link
                key={book.id}
                href={`/word-books/${book.id}`}
                className="flex items-center justify-between gap-4 py-3.5 transition hover:opacity-70"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {book.title}
                  </p>
                  {book.description ? (
                    <p className="mt-0.5 truncate text-xs text-ink/40">
                      {book.description}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-ink/35">
                  {meta.count}개 · {meta.rate}%
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
