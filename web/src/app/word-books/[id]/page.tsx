"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { EmptyState, GhostButton, PageHeader, PrimaryLink } from "@/components/ui";
import { WordBookStats } from "@/components/word-book-stats";
import { activeWords, useVocab } from "@/lib/vocab-store";

const PAGE_SIZE = 20;

export default function WordBookDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { getWordBook, deleteWordBook } = useVocab();
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [pagedBookId, setPagedBookId] = useState(params.id);
  const book = getWordBook(params.id);

  // 다른 단어장으로 이동하면 페이지를 1로 되돌린다 (렌더 중 상태 조정 패턴)
  if (pagedBookId !== params.id) {
    setPagedBookId(params.id);
    setPage(1);
  }

  if (!book) {
    return (
      <main className="mx-auto w-full max-w-4xl px-8 py-14 lg:px-12">
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

  const words = activeWords(book);
  const totalPages = Math.max(1, Math.ceil(words.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedWords = words.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const handleDeleteBook = async () => {
    if (
      !window.confirm(
        `"${book.title}" 단어장을 삭제할까요?\n안의 단어도 함께 삭제됩니다.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await deleteWordBook(book.id);
      router.push("/word-books");
    } catch (reason) {
      window.alert(
        reason instanceof Error ? reason.message : "단어장을 삭제하지 못했어요.",
      );
      setDeleting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-8 py-14 lg:px-12">
      <PageHeader
        title={book.title}
        description={book.description}
        actions={
          <div className="flex items-center gap-1">
            <PrimaryLink href={`/word-books/${book.id}/words/new`}>
              단어 추가
            </PrimaryLink>
            <GhostButton
              className="text-umber/45 hover:bg-transparent hover:text-red-600"
              disabled={deleting}
              onClick={() => void handleDeleteBook()}
            >
              {deleting ? "삭제 중…" : "삭제"}
            </GhostButton>
          </div>
        }
      />

      <WordBookStats book={book} />

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
        <>
          <ul className="divide-y divide-taupe/25 border-t border-taupe/25">
            {pagedWords.map((word) => (
              <li key={word.id}>
                <Link
                  href={`/word-books/${book.id}/words/${word.id}`}
                  className="group flex items-baseline gap-6 py-3.5 transition-colors"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink group-hover:text-umber">
                    {word.term}
                    {word.pronunciation ? (
                      <span className="ml-2 text-xs font-normal text-umber/40">
                        {word.pronunciation}
                      </span>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-umber/60">
                    {word.meaning}
                  </span>
                  {word.memorizationStatus === "memorized" ? (
                    <span
                      aria-label="암기함"
                      className="size-1.5 shrink-0 rounded-full bg-[var(--chart-1)]"
                    />
                  ) : (
                    <span aria-hidden className="size-1.5 shrink-0" />
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <div className="mt-8 flex items-center justify-center gap-4">
              <GhostButton
                disabled={currentPage === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                이전
              </GhostButton>
              <span className="text-xs tabular-nums text-umber/50">
                {currentPage} / {totalPages}
              </span>
              <GhostButton
                disabled={currentPage === totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
              >
                다음
              </GhostButton>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
