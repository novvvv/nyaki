"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { Badge, EmptyState, GhostButton, PageHeader, PrimaryLink } from "@/components/ui";
import { activeWords, bookMeta, useVocab } from "@/lib/vocab-store";

export default function WordBookDetailPage() {
  const params = useParams<{ id: string }>();
  const { getWordBook } = useVocab();
  const book = getWordBook(params.id);

  if (!book) {
    return (
      <main className="mx-auto max-w-2xl px-8 py-10">
        <PageHeader
          title="단어장을 찾을 수 없습니다"
          description="목록에서 다른 단어장을 선택해 주세요."
          actions={
            <GhostButton onClick={() => window.history.back()}>뒤로</GhostButton>
          }
        />
      </main>
    );
  }

  const meta = bookMeta(book);
  const words = activeWords(book);

  return (
    <main className="mx-auto max-w-2xl px-8 py-10">
      <PageHeader
        title={book.title}
        description={
          book.description ?? `${meta.count}개 · 암기 ${meta.rate}%`
        }
        actions={
          <PrimaryLink href={`/word-books/${book.id}/words/new`}>
            단어 추가
          </PrimaryLink>
        }
      />

      {words.length === 0 ? (
        <EmptyState
          title="단어가 없습니다"
          description="첫 단어를 추가해 보세요."
          action={
            <PrimaryLink href={`/word-books/${book.id}/words/new`}>
              단어 추가
            </PrimaryLink>
          }
        />
      ) : (
        <div className="divide-y divide-ink/[0.06] rounded-lg border border-ink/[0.06]">
          {words.map((word) => (
            <Link
              key={word.id}
              href={`/word-books/${book.id}/words/${word.id}`}
              className="flex items-start justify-between gap-4 px-4 py-3.5 transition hover:bg-subtle"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{word.term}</p>
                <p className="mt-0.5 text-sm text-ink/50">{word.meaning}</p>
                {word.pronunciation ? (
                  <p className="mt-1 text-xs text-ink/35">{word.pronunciation}</p>
                ) : null}
              </div>
              <Badge>
                {word.memorizationStatus === "memorized" ? "암기" : "미암기"}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
