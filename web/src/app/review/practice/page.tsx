"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { GhostButton, PrimaryButton } from "@/components/ui";
import { useAppMode } from "@/lib/app-mode";
import { shuffled } from "@/lib/review";
import type { Word } from "@/lib/types";
import { cn } from "@/lib/utils";
import { activeWords, useVocab } from "@/lib/vocab-store";

/**
 * 연습 모드 — 단어를 계속 넘겨 본다. **채점하지 않는다.**
 *
 * 서버에는 아무것도 보내지 않는다(이미 받아 둔 단어만 쓴다). 그래서 복습 주기 ·
 * 복습 기록 · 통계 어디에도 남지 않는다. 테스트 시작 화면에서 고른 단어장을
 * ?books=a,b 로 받는다. 없으면 모든 단어장이다. 빈칸 노트는 아직 빠진다.
 */

const SCREEN = "review-screen min-h-[calc(100vh-8.5rem)]";

const noop = () => () => {};
/** 브라우저에서 그리는 중인가. 섞기(Math.random)를 서버 렌더와 맞추려고 쓴다. */
function useMounted() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

function PracticeScreen() {
  const params = useSearchParams();
  const { wordBooks, loading: vocabLoading } = useVocab();
  const appMode = useAppMode();
  // 서버 렌더에서는 섞지 않는다 — 섞은 순서가 브라우저와 달라 화면이 어긋난다.
  const mounted = useMounted();
  const loading = vocabLoading || !mounted;

  const bookIds = useMemo(() => {
    const raw = params.get("books");
    return raw ? raw.split(",").filter(Boolean) : null;
  }, [params]);

  const words = useMemo(
    () =>
      wordBooks
        .filter((book) => !bookIds || bookIds.includes(book.id))
        .flatMap((book) => activeWords(book)),
    [wordBooks, bookIds],
  );

  // 처음 받았을 때 한 번 섞는다. "다시 섞기"를 누르면 round가 올라 새로 섞는다.
  const [round, setRound] = useState(0);
  const deck = useMemo<Word[]>(
    () => (mounted ? shuffled(words) : []),
    // round는 다시 섞으라는 신호로만 쓴다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [words.length, round, mounted],
  );
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const total = deck.length;
  const done = total > 0 && index >= total;
  const card = done ? undefined : deck[index];
  // PC에서 사진이 있으면 사진을 왼쪽에 크게, 글을 오른쪽에 둔다(테스트 카드와 같다).
  const sideBySide = !appMode && !!card?.photoUrl;

  const go = useCallback(
    (step: 1 | -1) => {
      setFlipped(false);
      setIndex((prev) => Math.min(Math.max(prev + step, 0), total));
    },
    [total],
  );

  function restart() {
    setRound((prev) => prev + 1);
    setIndex(0);
    setFlipped(false);
  }

  // 키보드 — ←/→ 넘기기, 스페이스 · 엔터 뒤집기.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input, textarea")
      )
        return;
      if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
      else if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setFlipped((prev) => !prev);
      } else return;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const head = (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1
          className={cn(
            "font-semibold tracking-tight text-ink",
            appMode ? "text-[22px] font-bold" : "text-xl",
          )}
        >
          연습 모드
        </h1>
        <p className="mt-1 text-xs text-ink/45">
          넘겨 보기만 해요. 복습 기록과 다음 복습일에는 남지 않아요.
        </p>
      </div>
      <Link
        href="/review"
        className="web-only shrink-0 text-xs text-ink/45 transition hover:text-ink"
      >
        테스트로
      </Link>
    </div>
  );

  if (loading) {
    return (
      <main className={cn(SCREEN, "mx-auto w-full max-w-xl px-6 py-10")}>
        {head}
        <p className="mt-10 text-sm text-ink/40">불러오는 중…</p>
      </main>
    );
  }

  if (total === 0) {
    return (
      <main className={cn(SCREEN, "mx-auto w-full max-w-xl px-6 py-10")}>
        {head}
        <div className="mt-10 rounded-2xl border border-dashed border-taupe/60 p-6 text-center">
          <p className="text-sm text-ink/60">연습할 단어가 없어요.</p>
          <Link
            href="/word-books"
            className="mt-3 inline-block text-sm font-medium text-ink underline-offset-4 hover:underline"
          >
            단어장으로 가기
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className={cn(
        SCREEN,
        "mx-auto flex w-full max-w-xl flex-col px-6 py-10",
        !appMode && "md:max-w-2xl",
        appMode && "py-5",
      )}
    >
      {head}

      <div className="mt-6 flex items-center gap-3">
        <div
          className={cn(
            "h-px flex-1 bg-ink/10",
            appMode && "h-1.5 rounded-full",
          )}
        >
          <div
            className={cn(
              "h-px bg-ink transition-all duration-200",
              appMode && "h-full rounded-full",
            )}
            style={{ width: `${(Math.min(index + 1, total) / total) * 100}%` }}
          />
        </div>
        <span className="text-xs tabular-nums text-ink/45">
          {Math.min(index + 1, total)} / {total}
        </span>
      </div>

      {card ? (
        <button
          type="button"
          onClick={() => setFlipped((prev) => !prev)}
          className={cn(
            "flex flex-1 cursor-pointer flex-col items-center justify-center gap-6 text-center",
            // 테스트 카드와 같은 모양 — 앱은 여백만 조금 좁다.
            "my-6 px-8 py-10",
            "rounded-3xl border border-ink/80 bg-cream shadow-[0_8px_0_-1px_#efd6d6] dark:shadow-[0_8px_0_-1px_rgba(239,214,214,0.3)]",
            appMode && "my-5 px-5 py-8",
            sideBySide && "md:flex-row md:gap-10",
          )}
        >
          {card.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.photoUrl}
              alt=""
              className={cn(
                "max-h-52 w-auto max-w-full rounded-2xl object-contain",
                sideBySide &&
                  "md:max-h-[26rem] md:w-[46%] md:max-w-none md:shrink-0",
              )}
            />
          ) : null}
          <div
            className={cn(
              "flex flex-col items-center gap-6",
              sideBySide && "md:min-w-0 md:flex-1",
            )}
          >
            <div className="whitespace-pre-wrap text-4xl font-semibold tracking-tight text-ink">
              {card.term}
            </div>
            {flipped ? (
              <div className="space-y-3">
                {card.pronunciation ? (
                  <p className="text-base text-ink/45">{card.pronunciation}</p>
                ) : null}
                <p className="whitespace-pre-wrap text-2xl text-ink">
                  {card.meaning}
                </p>
                {card.example ? (
                  <p className="pt-4 text-base text-ink/55">{card.example}</p>
                ) : null}
                {card.exampleMeaning ? (
                  <p className="text-sm text-ink/40">{card.exampleMeaning}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-ink/25">눌러서 뜻 보기</p>
            )}
          </div>
        </button>
      ) : (
        <div className="my-10 flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-lg font-semibold text-ink">다 넘겨 봤어요</p>
          <p className="text-sm text-ink/45">단어 {total}개</p>
        </div>
      )}

      {done ? (
        <div className="grid grid-cols-2 gap-2.5">
          <PrimaryButton
            onClick={restart}
            className={cn("py-3", appMode && "rounded-full py-3.5")}
          >
            다시 섞어서 보기
          </PrimaryButton>
          <Link
            href="/review"
            className={cn(
              "inline-flex items-center justify-center rounded-lg border border-taupe/60 py-3 text-sm font-medium text-ink transition hover:bg-subtle",
              appMode && "rounded-full py-3.5",
            )}
          >
            테스트로
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          <GhostButton
            onClick={() => go(-1)}
            disabled={index === 0}
            className={cn(
              "border border-taupe/60 py-3 text-ink",
              appMode && "rounded-full py-3.5",
            )}
          >
            ← 이전
          </GhostButton>
          <PrimaryButton
            onClick={() => go(1)}
            className={cn("py-3", appMode && "rounded-full py-3.5")}
          >
            다음 →
          </PrimaryButton>
        </div>
      )}
    </main>
  );
}

export default function PracticePage() {
  // useSearchParams는 정적 프리렌더 중에 값을 알 수 없어 Suspense가 필요하다.
  return (
    <Suspense fallback={<main className={SCREEN} />}>
      <PracticeScreen />
    </Suspense>
  );
}
