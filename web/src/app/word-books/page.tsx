"use client";

import Link from "next/link";
import { useState } from "react";

import {
  EmptyState,
  GhostButton,
  PageHeader,
  TextInput,
} from "@/components/ui";
import { bookMeta, useVocab } from "@/lib/vocab-store";

export default function WordBooksPage() {
  const { wordBooks, loading, error, createWordBook } = useVocab();
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

  const createActions = creating ? (
    <div className="flex items-center gap-2">
      <TextInput
        className="w-40 py-1.5 text-sm"
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        placeholder="이름"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") void handleCreate();
          if (e.key === "Escape") setCreating(false);
        }}
      />
      <button
        type="button"
        disabled={!newTitle.trim()}
        onClick={() => void handleCreate()}
        className="inline-flex items-center rounded-md border border-taupe/50 bg-cream px-3 py-1.5 text-sm text-umber/70 transition hover:border-taupe hover:bg-subtle hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        만들기
      </button>
      <GhostButton
        className="px-2 py-1.5 text-sm text-ink/40"
        onClick={() => setCreating(false)}
      >
        취소
      </GhostButton>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setCreating(true)}
      className="inline-flex items-center rounded-md border border-taupe/45 bg-cream px-3 py-1.5 text-sm text-umber/60 transition hover:border-taupe hover:bg-subtle hover:text-ink"
    >
      + 새 단어장
    </button>
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-8 py-10 lg:px-12">
      <PageHeader
        title="단어장"
        description="모바일과 동기화되는 단어장을 관리합니다."
        actions={createActions}
      />

      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-ink/40">불러오는 중…</p>
      ) : wordBooks.length === 0 ? (
        <EmptyState
          title="단어장이 없습니다"
          description="오른쪽 위 새 단어장으로 만들어 보세요."
          action={
            creating ? undefined : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="inline-flex items-center rounded-md border border-taupe/45 bg-cream px-3 py-1.5 text-sm text-umber/60 transition hover:border-taupe hover:bg-subtle hover:text-ink"
              >
                + 새 단어장
              </button>
            )
          }
        />
      ) : (
        <div className="divide-y divide-taupe/35">
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
                    <p className="mt-0.5 truncate text-xs text-umber/55">
                      {book.description}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-umber/50">
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
