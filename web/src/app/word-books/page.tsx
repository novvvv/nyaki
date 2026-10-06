"use client";

import Link from "next/link";
import { useState } from "react";

import { EmptyState, PageHeader } from "@/components/ui";
import type { BookSummary } from "@/lib/api-client";
import type { WordBook } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useVocab } from "@/lib/vocab-store";

/** 새 폴더. 단어장과 같은 모양의 별도 화면으로 보낸다. */
function NewFolderLink() {
  return (
    <Link
      href="/word-books/folders/new"
      className="inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-taupe/40 px-3 py-1.5 text-sm text-umber/65 transition hover:border-taupe/70 hover:text-ink"
    >
      새 폴더
    </Link>
  );
}

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

/** 단어장 한 줄. 폴더 안이면 들여쓴다. */
function BookRow({
  book,
  summary,
  nested,
}: {
  book: WordBook;
  summary: BookSummary | undefined;
  nested: boolean;
}) {
  return (
    <li>
      <Link
        href={`/word-books/${book.id}`}
        className={cn(
          "group flex items-center justify-between gap-6 py-4",
          nested && "pl-5",
        )}
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
          {/* 숫자는 서버가 센 값을 쓴다 — 빈칸 노트도 항목으로 잡힌다. */}
          <span className="text-xs tabular-nums text-umber/45">
            {summary?.itemCount ?? 0}개
          </span>
        </div>
      </Link>
    </li>
  );
}

export default function WordBooksPage() {
  const { wordBooks, folders, summaries, loading, error } = useVocab();
  // 접어둔 폴더. 처음에는 모두 펼친다.
  const [collapsed, setCollapsed] = useState<string[]>([]);

  // 사이드바와 같은 구성 — 폴더들 먼저, 그다음 폴더 밖 단어장.
  // 폴더 id가 남아 있는데 그 폴더를 못 찾으면(동기화 중 등) 밖으로 보여준다.
  // 숨기면 그 단어장으로 들어갈 길이 없어진다.
  const folderIds = new Set(folders.map((folder) => folder.id));
  const loose = wordBooks.filter(
    (book) => !book.folderId || !folderIds.has(book.folderId),
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-8 py-14 lg:px-12">
      <PageHeader
        title="단어장"
        actions={
          <div className="flex items-center gap-2">
            <NewFolderLink />
            <NewBookLink />
          </div>
        }
      />

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
            {folders.map((folder) => {
              const books = wordBooks.filter(
                (book) => book.folderId === folder.id,
              );
              const open = !collapsed.includes(folder.id);
              return (
                <li key={folder.id}>
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
                    className="flex w-full items-center justify-between gap-6 py-4 text-left"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className="w-3 shrink-0 text-xs text-ink/35"
                      >
                        {open ? "▾" : "▸"}
                      </span>
                      <span className="truncate text-sm font-semibold text-ink">
                        {folder.title}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-umber/45">
                      단어장 {books.length}개
                    </span>
                  </button>
                  {open && books.length > 0 ? (
                    <ul className="divide-y divide-taupe/15 border-t border-taupe/15">
                      {books.map((book) => (
                        <BookRow
                          key={book.id}
                          book={book}
                          summary={summaries[book.id]}
                          nested
                        />
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
            {loose.map((book) => (
              <BookRow
                key={book.id}
                book={book}
                summary={summaries[book.id]}
                nested={false}
              />
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
