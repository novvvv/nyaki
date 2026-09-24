"use client";

import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/ui";
import { useVocab } from "@/lib/vocab-store";

function NewBookLink() {
  return (
    <Link
      href="/word-books/new"
      className="inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-taupe/40 px-3 py-1.5 text-sm text-umber/65 transition hover:border-taupe/70 hover:text-ink"
    >
      새 단어장
    </Link>
  );
}

export default function WordBooksPage() {
  const { wordBooks, summaries, loading, error } = useVocab();

  return (
    <main className="mx-auto w-full max-w-6xl px-8 py-14 lg:px-12">
      <PageHeader title="단어장" actions={<NewBookLink />} />

      {error ? <p className="mb-6 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-umber/40">불러오는 중…</p>
      ) : wordBooks.length === 0 ? (
        <EmptyState
          title="단어장이 없습니다"
          description="오른쪽 위에서 첫 단어장을 만들어 보세요."
          action={<NewBookLink />}
        />
      ) : (
        <ul className="divide-y divide-taupe/25 border-t border-taupe/25">
          {wordBooks.map((book) => {
            // 숫자는 서버가 센 값을 쓴다 — 빈칸 노트도 항목으로 잡힌다.
            const summary = summaries[book.id];
            return (
              <li key={book.id}>
                <Link
                  href={`/word-books/${book.id}`}
                  className="group flex items-center justify-between gap-6 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink transition-colors group-hover:text-umber">
                      {book.title}
                    </p>
                    {book.description ? (
                      <p className="mt-0.5 truncate text-xs text-umber/45">
                        {book.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs tabular-nums text-umber/45">
                      {summary?.itemCount ?? 0}개
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
