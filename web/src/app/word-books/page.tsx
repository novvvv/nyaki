"use client";

import Link from "next/link";
import { useState } from "react";

import {
  EmptyState,
  GhostButton,
  PageHeader,
  SubtleButton,
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
    <div className="flex items-center gap-1.5">
      <TextInput
        className="w-44 py-1.5"
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        placeholder="단어장 이름"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") void handleCreate();
          if (e.key === "Escape") setCreating(false);
        }}
      />
      <SubtleButton
        className="py-1.5"
        disabled={!newTitle.trim()}
        onClick={() => void handleCreate()}
      >
        만들기
      </SubtleButton>
      <GhostButton
        className="px-2 py-1.5 text-umber/40"
        onClick={() => setCreating(false)}
      >
        취소
      </GhostButton>
    </div>
  ) : (
    <SubtleButton className="py-1.5" onClick={() => setCreating(true)}>
      새 단어장
    </SubtleButton>
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-8 py-14 lg:px-12">
      <PageHeader title="단어장" actions={createActions} />

      {error ? (
        <p className="mb-6 text-sm text-red-700">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-umber/40">불러오는 중…</p>
      ) : wordBooks.length === 0 ? (
        <EmptyState
          title="단어장이 없습니다"
          description="오른쪽 위에서 첫 단어장을 만들어 보세요."
          action={
            creating ? undefined : (
              <SubtleButton onClick={() => setCreating(true)}>
                새 단어장
              </SubtleButton>
            )
          }
        />
      ) : (
        <ul className="divide-y divide-taupe/25 border-t border-taupe/25">
          {wordBooks.map((book) => {
            const meta = bookMeta(book);
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
                      {meta.count}
                    </span>
                    <span
                      aria-hidden
                      className="h-1 w-16 overflow-hidden rounded-full bg-taupe/25"
                    >
                      <span
                        className="block h-full rounded-full bg-[var(--chart-1)] transition-[width] duration-500"
                        style={{ width: `${meta.rate}%` }}
                      />
                    </span>
                    <span className="w-9 text-right text-xs tabular-nums text-umber/45">
                      {meta.rate}%
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
