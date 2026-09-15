"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { activeWords, useVocab } from "@/lib/vocab-store";
import { cn } from "@/lib/utils";
import type { Word } from "@/lib/types";

type Grade = "again" | "good";
type Phase = "setup" | "session" | "done";

const SCREEN = "min-h-[calc(100vh-8.5rem)]";

function shuffle(words: Word[]) {
  const next = [...words];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export default function ReviewPage() {
  const { wordBooks, loading } = useVocab();
  const allWords = useMemo(
    () => wordBooks.flatMap((book) => activeWords(book)),
    [wordBooks],
  );

  const [phase, setPhase] = useState<Phase>("setup");
  const [countText, setCountText] = useState("20");
  const [queue, setQueue] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [result, setResult] = useState({ again: 0, good: 0 });

  const current = queue[index];

  const parsed = Number.parseInt(countText, 10);
  const size = Number.isNaN(parsed)
    ? 0
    : Math.min(Math.max(parsed, 1), allWords.length);

  // 채점 결과는 아직 서버로 보내지 않는다 — POST /v1/review/grades 미구현.
  // 세션이 끝나면 화면에만 요약을 보여준다. docs/WEB-REVIEW-PLAN.md 8절 참고.
  const grade = useCallback(
    (value: Grade) => {
      setResult((prev) => ({ ...prev, [value]: prev[value] + 1 }));
      setFlipped(false);

      const next = index + 1;
      if (next >= queue.length) {
        setPhase("done");
      } else {
        setIndex(next);
      }
    },
    [index, queue.length],
  );

  useEffect(() => {
    if (phase !== "session") return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setFlipped((prev) => !prev);
      } else if (event.key === "ArrowLeft") {
        grade("again");
      } else if (event.key === "ArrowRight") {
        grade("good");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, grade]);

  function start() {
    if (size < 1) return;
    setQueue(shuffle(allWords).slice(0, size));
    setIndex(0);
    setFlipped(false);
    setResult({ again: 0, good: 0 });
    setPhase("session");
  }

  if (phase === "session" && current) {
    return (
      <main
        className={cn(
          SCREEN,
          "mx-auto flex w-full max-w-xl flex-col px-6 py-10",
        )}
      >
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={() => setPhase("done")}
            className="whitespace-nowrap rounded-lg border border-taupe px-4 py-1.5 text-xs text-ink/50 transition hover:border-ink/40 hover:text-ink"
          >
            그만하기
          </button>
        </div>

        <p className="mb-6 flex items-center justify-end gap-2 text-ink">
          {/* 픽셀 폰트는 한자·한글이 없다 — 이 가나 문구에만 쓴다 */}
          <span className="font-pixel text-base">がんばろう！</span>
          <span className="text-base font-semibold">✧/ᐠ-ꞈ-ᐟ\</span>
        </p>

        <div className="flex items-center gap-4">
          <span className="shrink-0 text-xs tabular-nums text-ink/35">
            {index + 1} / {queue.length}
          </span>
          <div className="h-px flex-1 bg-taupe/50">
            <div
              className="h-px bg-ink transition-all duration-200"
              style={{ width: `${(index / queue.length) * 100}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setFlipped((prev) => !prev)}
          className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-6 text-center"
        >
          <p className="text-4xl font-semibold tracking-tight text-ink">
            {current.term}
          </p>

          {flipped ? (
            <div className="space-y-3">
              {current.pronunciation ? (
                <p className="text-base text-ink/45">{current.pronunciation}</p>
              ) : null}
              <p className="text-2xl text-ink">{current.meaning}</p>
              {current.example ? (
                <p className="pt-4 text-base text-ink/55">{current.example}</p>
              ) : null}
              {current.exampleMeaning ? (
                <p className="text-sm text-ink/40">{current.exampleMeaning}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-ink/25">눌러서 뜻 보기</p>
          )}
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => grade("again")}
            className="whitespace-nowrap rounded-lg border border-ink py-3.5 text-sm font-medium text-ink transition hover:bg-subtle"
          >
            모름
          </button>
          <button
            type="button"
            onClick={() => grade("good")}
            className="group relative whitespace-nowrap rounded-lg border border-ink bg-ink py-3.5 text-sm font-medium text-cream transition hover:bg-ink/85"
          >
            <svg
              viewBox="0 0 40 14"
              aria-hidden
              className="absolute -top-3 right-3 h-3.5 w-10 fill-ink transition group-hover:fill-ink/85"
            >
              <path d="M1.5 14 C2.6 8.5 4 4 6.2 0 C8.6 4.2 10.8 9 13 14 Z" />
              <path d="M27 14 C29.2 9 31.4 4.2 33.8 0 C36 4 37.4 8.5 38.5 14 Z" />
            </svg>
            <span
              aria-hidden
              className="absolute right-10 top-2 flex size-2 items-center justify-center"
            >
              <span className="h-[2px] w-2 rounded-full bg-cream transition-all duration-200 group-hover:h-2 group-hover:w-[2px]" />
            </span>
            <span
              aria-hidden
              className="absolute right-[22px] top-2 flex size-2 items-center justify-center"
            >
              <span className="h-[2px] w-2 rounded-full bg-cream transition-all duration-200 group-hover:h-2 group-hover:w-[2px]" />
            </span>
            외움
          </button>
        </div>
      </main>
    );
  }

  if (phase === "done") {
    return (
      <main
        className={cn(
          SCREEN,
          "mx-auto flex w-full max-w-xl flex-col items-center justify-center px-6 py-14 text-center",
        )}
      >
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          테스트 완료
        </h1>

        <div className="mt-10 grid w-full grid-cols-2 border-y border-taupe/50">
          <div className="border-r border-taupe/50 py-7">
            <p className="text-4xl font-semibold tabular-nums text-ink">
              {result.good}
            </p>
            <p className="mt-1.5 text-xs text-ink/40">외움</p>
          </div>
          <div className="py-7">
            <p className="text-4xl font-semibold tabular-nums text-ink">
              {result.again}
            </p>
            <p className="mt-1.5 text-xs text-ink/40">모름</p>
          </div>
        </div>

        <div className="mt-10 flex items-center gap-6">
          <button
            type="button"
            onClick={() => setPhase("setup")}
            className="whitespace-nowrap text-sm font-medium text-ink transition hover:text-ink/55"
          >
            다시 하기
          </button>
          <Link
            href="/word-books"
            className="whitespace-nowrap text-sm text-ink/40 transition hover:text-ink"
          >
            내 단어장
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className={cn(
        SCREEN,
        "mx-auto flex w-full max-w-xl flex-col items-center justify-center px-6 py-14 text-center",
      )}
    >
      <h1 className="text-2xl font-semibold tracking-tight text-ink">테스트</h1>

      {loading ? (
        <p className="mt-3 text-sm text-ink/40">불러오는 중…</p>
      ) : allWords.length === 0 ? (
        <>
          <p className="mt-3 text-sm text-ink/40">테스트할 단어가 없습니다</p>
          <Link
            href="/word-books"
            className="mt-8 whitespace-nowrap text-sm text-ink/45 transition hover:text-ink"
          >
            내 단어장으로 →
          </Link>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-ink/40">
            단어 {allWords.length}개 중에서 무작위로 출제합니다
          </p>

          <div className="mt-12 flex items-end justify-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={allWords.length}
              value={countText}
              onChange={(e) => setCountText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") start();
              }}
              aria-label="출제할 단어 개수"
              className="w-28 border-b border-taupe/60 bg-transparent pb-1.5 text-center text-4xl font-semibold tabular-nums text-ink outline-none transition focus:border-ink"
            />
            <span className="pb-2.5 text-sm text-ink/35">개</span>
          </div>

          <input
            type="range"
            min={1}
            max={allWords.length}
            value={size || 1}
            onChange={(e) => setCountText(e.target.value)}
            aria-label="출제할 단어 개수 조절"
            className="mt-9 h-1 w-full max-w-xs cursor-pointer accent-ink"
          />

          <button
            type="button"
            onClick={start}
            disabled={size < 1}
            className="mt-12 whitespace-nowrap text-sm font-medium text-ink transition hover:text-ink/55 disabled:cursor-not-allowed disabled:text-ink/25"
          >
            시작하기 →
          </button>
        </>
      )}
    </main>
  );
}
