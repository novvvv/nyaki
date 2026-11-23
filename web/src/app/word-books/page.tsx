"use client";

import Link from "next/link";
import { useState } from "react";

import { AppWordBooks } from "@/components/app-word-books";
import { Chevron, ItemIcon } from "@/components/tree-icons";
import { EmptyState, PageHeader } from "@/components/ui";
import type { BookSummary } from "@/lib/api-client";
import { useAppMode } from "@/lib/app-mode";
import type { WordBook } from "@/lib/types";
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

/** 단어장 한 줄 — 사이드바처럼 문서 아이콘 · 이름 · 개수. 폴더 안이면 트리 선 안쪽에 들어간다. */
function BookRow({
  book,
  summary,
}: {
  book: WordBook;
  summary: BookSummary | undefined;
}) {
  return (
    <li>
      <Link
        href={`/word-books/${book.id}`}
        className="group flex items-center justify-between gap-4 rounded-lg px-3 py-3 transition hover:bg-subtle/70"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <ItemIcon src="/sidebar/doc_unclicked.png" />
          <span className="min-w-0">
            <span className="block truncate text-sm text-ink">
              {book.title}
            </span>
            {book.description ? (
              <span className="mt-0.5 block truncate text-xs text-umber/45">
                {book.description}
              </span>
            ) : null}
          </span>
        </span>
        {/* 숫자는 서버가 센 값을 쓴다 — 빈칸 노트도 항목으로 잡힌다. */}
        <span className="shrink-0 text-xs tabular-nums text-ink/35">
          {summary?.itemCount ?? 0}개
        </span>
      </Link>
    </li>
  );
}

export default function WordBooksPage() {
  const { wordBooks, folders, summaries, loading, error } = useVocab();
  // 접어둔 폴더. 처음에는 모두 펼친다.
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const appMode = useAppMode();

  // 앱에서는 폴더별 타일로 보여 준다(components/app-word-books.tsx).
  if (appMode) return <AppWordBooks />;

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

          <ul className="space-y-1 lg:hidden">
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
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-3 text-left transition hover:bg-subtle/70"
                  >
                    {/* 사이드바와 같다 — 펼친 폴더는 채운 아이콘, 접은 폴더는 빈 아이콘 */}
                    <ItemIcon
                      src={
                        open
                          ? "/sidebar/folder_clicked.png"
                          : "/sidebar/folder_unclicked.png"
                      }
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                      {folder.title}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-ink/35">
                      단어장 {books.length}개
                    </span>
                    <Chevron open={open} className="text-ink/45" />
                  </button>
                  {open ? (
                    <ul className="mb-2 ml-5 space-y-0.5 border-l border-taupe/30 pl-2">
                      {books.length === 0 ? (
                        <li className="px-3 py-2 text-xs text-ink/30">
                          비어 있음
                        </li>
                      ) : (
                        books.map((book) => (
                          <BookRow
                            key={book.id}
                            book={book}
                            summary={summaries[book.id]}
                          />
                        ))
                      )}
                    </ul>
                  ) : null}
                </li>
              );
            })}
            {loose.length > 0 && folders.length > 0 ? (
              <li aria-hidden className="mx-3 my-2 border-t border-taupe/25" />
            ) : null}
            {loose.map((book) => (
              <BookRow key={book.id} book={book} summary={summaries[book.id]} />
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
