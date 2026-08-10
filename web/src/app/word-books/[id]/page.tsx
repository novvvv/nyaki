"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  EmptyState,
  GhostButton,
  PageHeader,
  PrimaryLink,
} from "@/components/ui";
import { activeWords, bookMeta, useVocab } from "@/lib/vocab-store";

const PAGE_SIZE = 20;

export default function WordBookDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { getWordBook, deleteWordBook } = useVocab();
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const book = getWordBook(params.id);

  useEffect(() => {
    setPage(1);
  }, [params.id]);

  if (!book) {
    return (
      <main className="mx-auto w-full max-w-6xl px-8 py-10 lg:px-12">
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
  const totalPages = Math.max(1, Math.ceil(words.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedWords = words.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const handleDeleteBook = async () => {
    if (!window.confirm(`"${book.title}" 단어장을 삭제할까요?\n안의 단어도 함께 삭제됩니다.`)) {
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
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-8 py-10 lg:px-12">
      <PageHeader
        title={book.title}
        description={
          book.description ?? `${meta.count}개 · 암기 ${meta.rate}%`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PrimaryLink href={`/word-books/${book.id}/words/new`}>
              단어 추가
            </PrimaryLink>
            <GhostButton
              className="text-red-600 hover:bg-red-50"
              disabled={deleting}
              onClick={() => void handleDeleteBook()}
            >
              {deleting ? "삭제 중…" : "단어장 삭제"}
            </GhostButton>
          </div>
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
        <>
          <div className="divide-y divide-taupe/35 rounded-lg border border-taupe/45">
            {pagedWords.map((word) => (
              <Link
                key={word.id}
                href={`/word-books/${book.id}/words/${word.id}`}
                className="flex items-start justify-between gap-4 px-4 py-3.5 transition hover:bg-subtle/60"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{word.term}</p>
                  <p className="mt-0.5 text-sm text-umber/65">{word.meaning}</p>
                  {word.pronunciation ? (
                    <p className="mt-1 text-xs text-umber/45">{word.pronunciation}</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-center gap-3">
              <GhostButton
                disabled={currentPage === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                이전
              </GhostButton>
              <span className="text-sm text-umber/65">
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
