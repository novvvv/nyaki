"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  EmptyState,
  GhostButton,
  PageHeader,
  PrimaryLink,
  SubtleButton,
} from "@/components/ui";
import { useAuth } from "@/components/auth-provider";
import {
  fetchBookSummaries,
  fetchClozeNotes,
  type BookSummary,
} from "@/lib/api-client";
import { CARD_KIND_LABELS, type CardKind, type ClozeNote } from "@/lib/types";
import { cn } from "@/lib/utils";
import { WORD_PAGE_SIZE as PAGE_SIZE } from "@/lib/constants";
import { activeWords, useVocab } from "@/lib/vocab-store";

type WordFilter = "all" | "bookmarked";

/** 목록 한 줄 — 단어와 빈칸 노트를 같은 모양으로 담는다. */
interface Item {
  id: string;
  kind: "word" | "cloze";
  createdAt: string;
  primary: string;
  hint?: string;
  secondary: string;
  href?: string;
  bookmarked: boolean;
}

function Row({ index, item }: { index: number; item: Item }) {
  const body = (
    <>
      <span className="w-7 shrink-0 text-right text-xs tabular-nums text-umber/35">
        {index}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink group-hover:text-umber">
        {item.primary}
        {item.hint ? (
          <span className="ml-2 text-xs font-normal text-umber/40">
            {item.hint}
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-umber/60">
        {item.secondary}
      </span>
    </>
  );

  // 빈칸 노트는 아직 상세 화면이 없다 — 링크 없이 줄만 보여준다.
  return item.href ? (
    <Link
      href={item.href}
      className="group flex items-baseline gap-6 py-3.5 transition-colors"
    >
      {body}
    </Link>
  ) : (
    <div className="flex items-baseline gap-6 py-3.5">{body}</div>
  );
}

/** 목록에 보여줄 한 줄 — 빈칸은 답을 괄호로 감싼다. */
function clozePreview(text: string): string {
  return text.replaceAll(/\{\{c\d+::(.+?)(?:::.+?)?\}\}/g, "[ $1 ]");
}

function clozeCount(text: string): number {
  return new Set([...text.matchAll(/\{\{c(\d+)::/g)].map((m) => m[1])).size;
}

export default function WordBookDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { getWordBook, deleteWordBook, updateWordBook } = useVocab();
  const { getToken } = useAuth();
  const [savingKinds, setSavingKinds] = useState(false);
  const [clozeNotes, setClozeNotes] = useState<ClozeNote[]>([]);
  const [summary, setSummary] = useState<BookSummary>();
  const [deleting, setDeleting] = useState(false);
  // 단어 추가 직후 새 단어가 있는 페이지로 바로 오도록, URL의 ?page=를 초기값으로 쓴다.
  const [page, setPage] = useState(() => {
    const fromUrl = Number(searchParams.get("page"));
    return Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : 1;
  });
  const [pagedBookId, setPagedBookId] = useState(params.id);
  const [filter, setFilter] = useState<WordFilter>("all");
  const book = getWordBook(params.id);

  // 빈칸 노트는 단어와 저장소가 달라 따로 받아온다.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const [notes, summaries] = await Promise.all([
          fetchClozeNotes(token, params.id),
          fetchBookSummaries(token),
        ]);
        if (cancelled) return;
        setClozeNotes(notes);
        setSummary(summaries[params.id]);
      } catch {
        // 목록을 못 받아도 단어 화면은 그대로 쓸 수 있다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, params.id]);


  // 다른 단어장으로 이동하면 페이지/필터를 초기 상태로 되돌린다 (렌더 중 상태 조정 패턴)
  if (pagedBookId !== params.id) {
    setPagedBookId(params.id);
    setPage(1);
    setFilter("all");
  }

  function selectFilter(next: WordFilter) {
    if (next === filter) return;
    setFilter(next);
    setPage(1);
  }

  if (!book) {
    return (
      <main className="mx-auto w-full max-w-6xl px-8 py-14 lg:px-12">
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
  const bookmarkedWords = words.filter((word) => word.isBookmarked);

  // 단어와 빈칸 노트를 한 목록으로 섞는다. 사용자에게는 둘 다 "외울 거리"다 —
  // 어디에 저장되는지는 알 바가 아니다.
  const items: Item[] = [
    ...words.map((word) => ({
      id: word.id,
      kind: "word" as const,
      createdAt: word.createdAt,
      primary: word.term,
      hint: word.pronunciation,
      secondary: word.meaning,
      href: `/word-books/${book.id}/words/${word.id}`,
      bookmarked: word.isBookmarked,
    })),
    ...clozeNotes.map((note) => ({
      id: note.id,
      kind: "cloze" as const,
      createdAt: note.createdAt,
      primary: clozePreview(note.text),
      secondary: `빈칸 ${clozeCount(note.text)}`,
      bookmarked: false,
    })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  // 앱 '정보' 탭과 같은 계산 — 단어별 점수(SM-2 간격 기반)의 평균이다.
  const visibleItems =
    filter === "bookmarked" ? items.filter((item) => item.bookmarked) : items;
  const totalPages = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = visibleItems.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const toggleKind = async (kind: CardKind) => {
    if (savingKinds) return;
    const current = book.cardKinds ?? ["recognition"];
    const next = current.includes(kind)
      ? current.filter((value) => value !== kind)
      : [...current, kind];

    // 전부 끄면 출제할 게 없어진다 — 서버도 최소 하나는 남기므로 여기서 막는다.
    if (next.length === 0) return;

    setSavingKinds(true);
    try {
      await updateWordBook(book.id, {
        title: book.title,
        description: book.description,
        cardKinds: next,
      });
    } catch (reason) {
      window.alert(
        reason instanceof Error ? reason.message : "카드 종류를 바꾸지 못했어요.",
      );
    } finally {
      setSavingKinds(false);
    }
  };

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
    <main className="mx-auto w-full max-w-6xl px-8 py-14 lg:px-12">
      <PageHeader
        title={book.title}
        description={book.description}
        actions={
          <div className="flex items-center gap-1">
            <PrimaryLink href={`/word-books/${book.id}/words/new`}>
              추가
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

      {summary && summary.itemCount > 0 ? (
        <p className="mb-8 text-xs tabular-nums text-umber/45">
          {summary.itemCount}개 · 카드 {summary.cardCount}장 · 암기{" "}
          {summary.masteryRate}%
        </p>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="아직 비어 있습니다"
          description="단어나 빈칸 문장을 추가해 보세요."
          action={
            <PrimaryLink href={`/word-books/${book.id}/words/new`}>
              추가
            </PrimaryLink>
          }
        />
      ) : (
        <>
          <div className="mb-9">
            <p className="text-xs font-semibold tracking-wide text-ink/35">
              카드 종류
            </p>
            <p className="mt-0.5 text-xs text-umber/45">
              고른 종류마다 카드가 따로 만들어지고 복습 일정도 따로 갑니다
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {(Object.keys(CARD_KIND_LABELS) as CardKind[]).map((kind) => {
                const on = (book.cardKinds ?? ["recognition"]).includes(kind);
                return (
                  <SubtleButton
                    key={kind}
                    aria-pressed={on}
                    disabled={savingKinds}
                    onClick={() => void toggleKind(kind)}
                    className={cn(
                      "px-3.5 py-1.5 text-xs",
                      on && "border-ink bg-ink text-cream hover:text-cream",
                    )}
                  >
                    {CARD_KIND_LABELS[kind]}
                  </SubtleButton>
                );
              })}
            </div>
          </div>

          <div className="mb-4 flex items-center gap-1">
            {(
              [
                { key: "all", label: "전체", count: items.length },
                {
                  key: "bookmarked",
                  label: "즐겨찾기",
                  count: bookmarkedWords.length,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => selectFilter(tab.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  filter === tab.key
                    ? "bg-ink text-cream"
                    : "text-umber/60 hover:bg-subtle hover:text-ink"
                }`}
              >
                {tab.label}
                <span className="ml-1 tabular-nums opacity-60">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {visibleItems.length === 0 ? (
            <EmptyState
              title="즐겨찾기한 단어가 없습니다"
              description="단어 상세에서 별표를 눌러 즐겨찾기에 추가해 보세요."
            />
          ) : (
            <>
              <ul className="divide-y divide-taupe/25 border-t border-taupe/25">
                {pagedItems.map((item, index) => (
                  <li key={item.id}>
                    <Row
                      index={(currentPage - 1) * PAGE_SIZE + index + 1}
                      item={item}
                    />
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
        </>
      )}
    </main>
  );
}
