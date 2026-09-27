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
        <>
          {/* 넓은 화면에는 사이드바가 이미 같은 목록을 그린다. 두 벌을 보여줄
              이유가 없다. 좁은 화면에서는 사이드바가 숨으므로(lg:block)
              여기가 단어장으로 들어가는 유일한 길이다 — 같이 지우면 막힌다. */}
          <p className="hidden text-sm text-umber/40 lg:block">
            왼쪽에서 단어장을 고르세요.
          </p>

          <ul className="divide-y divide-taupe/25 border-t border-taupe/25 lg:hidden">
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
        </>
      )}
    </main>
  );
}
