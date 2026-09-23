"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { PrimaryButton, SubtleButton } from "@/components/ui";
import {
  fetchDueCounts,
  fetchDueWords,
  pushGrades,
  pushGradesBeacon,
  type DueCard,
  type DueCounts,
  type ReviewGrade,
  type ReviewGradeItem,
} from "@/lib/api-client";
import { formatDelay, shuffled } from "@/lib/review";
import { cn } from "@/lib/utils";
import { CARD_KIND_LABELS } from "@/lib/types";
import { useVocab } from "@/lib/vocab-store";

type Phase = "setup" | "session" | "done";

const SCREEN = "min-h-[calc(100vh-8.5rem)]";
// 서버 /v1/review/due의 상한과 같다. 실제 출제량은 하루 한도(마이페이지)와
// 오늘 due인 단어 수가 정한다 — 이 값은 그 위에 얹힌 안전장치일 뿐이다.
const MAX_COUNT = 9999;

/**
 * 카드 앞면 — 무엇을 보고 떠올릴지는 종류가 정한다.
 *
 * 빈칸 카드는 서버가 이미 가려서 내려준다. 웹이 `{{cN::}}`을 다시 파싱하면
 * 앱과 렌더가 갈린다.
 */
function front(card: DueCard): string {
  if (card.cloze) return card.cloze.front;
  const word = card.word;
  if (!word) return "";
  return card.kind === "recall" ? word.meaning : word.term;
}

/** 카드 뒷면 — 앞면이 물은 것의 답. */
function back(card: DueCard): string {
  if (card.cloze) return card.cloze.back;
  const word = card.word;
  if (!word) return "";
  return card.kind === "recall" ? word.term : word.meaning;
}

/** 진행 줄에 붙는 종류 표시. 기본 카드에는 붙이지 않는다. */
function kindLabel(card: DueCard): string | null {
  if (card.sourceType === "cloze") return "빈칸";
  if (card.kind === "recall") return CARD_KIND_LABELS.recall;
  return null;
}

export default function ReviewPage() {
  const { getToken } = useAuth();
  const { wordBooks } = useVocab();

  const [phase, setPhase] = useState<Phase>("setup");
  const [countText, setCountText] = useState("20");
  const [queue, setQueue] = useState<DueCard[]>([]);
  // 진행 표시는 **카드 수** 기준이다. 학습 단계 때문에 한 카드가 세션 안에서
  // 여러 번 나오는데, 그때마다 분모가 늘면 "풀수록 늘어나는" 화면이 된다.
  const [sessionSize, setSessionSize] = useState(0);
  const [finished, setFinished] = useState(0);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [result, setResult] = useState({ again: 0, good: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  // 복습 주기가 돌아온 카드. 시작 화면의 상한이자 그대로 세션의 출제 목록이 된다.
  const [due, setDue] = useState<DueCard[]>();
  const [shuffle, setShuffle] = useState(false);
  // 단어장별 due 개수. /review/due(최대 200개)의 길이로 세면 201개부터 틀려서
  // 개수 전용 엔드포인트를 따로 부른다.
  const [counts, setCounts] = useState<DueCounts>();
  // 선택한 단어장. undefined면 "아직 안 정함" = 전체를 뜻한다.
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>();

  // 채점 결과는 세션이 끝날 때 한 번에 보낸다. 카드마다 보내면 30장에 30요청이
  // 되고, 매번 단어 전체를 재전송하게 된다. docs/WEB-REVIEW-PLAN.md 1절.
  // 화면을 다시 그리게 할 값이 아니라서 ref에 둔다.
  const pending = useRef<ReviewGradeItem[]>([]);
  const sent = useRef(false);

  const current = queue[index];

  // 단어장이 하나뿐이면 고를 이유가 없어 선택 줄을 숨긴다.
  const showBookPicker = wordBooks.length > 1;
  const selected = selectedBookIds ?? wordBooks.map((book) => book.id);
  const isSelected = (bookId: string) =>
    !showBookPicker || selected.includes(bookId);

  // 화면에 보여줄 개수는 서버가 센 값이다(상한 없음).
  const dueCount = counts
    ? showBookPicker
      ? selected.reduce((sum, id) => sum + (counts.byBook[id] ?? 0), 0)
      : counts.total
    : 0;

  // 슬라이더 상한. 실제로 출제할 수 있는 건 받아둔 목록(최대 200) 안에서
  // 선택한 단어장에 속한 것까지다.
  // 빈칸 카드는 단어가 없어 단어장을 화면에서 가릴 수 없다 — 항상 포함한다.
  // (서버가 단어장별 개수는 노트 기준으로 세어 내려준다)
  const picked = (due ?? []).filter(
    (card) => !card.word || isSelected(card.word.wordBookId),
  );
  const limit = Math.max(1, Math.min(picked.length, MAX_COUNT));

  const parsed = Number.parseInt(countText, 10);
  const size = Number.isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 1), limit);

  const flush = useCallback(async () => {
    if (sent.current || pending.current.length === 0) return;
    sent.current = true;
    try {
      const token = await getToken();
      if (token) await pushGrades(token, pending.current);
    } catch {
      // 실패해도 세션 요약은 보여준다. 다음 세션에서 다시 보낼 방법은 아직 없다.
      sent.current = false;
    }
  }, [getToken]);

  const grade = useCallback(
    (value: ReviewGrade) => {
      const card = queue[index];
      if (!card) return;

      pending.current.push({
        id: crypto.randomUUID(),
        wordId: card.word?.id ?? card.cloze?.noteId ?? card.id,
        cardId: card.id,
        grade: value,
        reviewedAt: new Date().toISOString(),
      });

      setResult((prev) => ({ ...prev, [value]: prev[value] + 1 }));
      setFlipped(false);

      // 채점한 카드는 이 세션에서 빠진다. 학습 단계가 잡아둔 다음 시각(1분·10분 뒤)은
      // 서버가 계산하고, 그 카드는 **다음 테스트**에서 다시 나온다.
      // 세션 안에서 다시 보여주면 진행이 늘 제자리라 끝이 안 보인다.
      setFinished((prev) => prev + 1);

      const next = index + 1;
      if (next >= queue.length) {
        setPhase("done");
        void flush();
      } else {
        setIndex(next);
      }
    },
    [flush, index, queue],
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

  // 세션 도중 탭을 닫으면 메모리에 쌓인 채점이 통째로 날아간다.
  // keepalive로 마지막에 한 번 더 보낸다 — 중복은 서버가 id로 걸러낸다.
  useEffect(() => {
    if (phase !== "session") return;

    function onHide() {
      if (document.visibilityState !== "hidden") return;
      if (sent.current || pending.current.length === 0) return;
      void getToken().then((token) => {
        if (token) pushGradesBeacon(token, pending.current);
      });
    }

    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [phase, getToken]);

  // 시작 화면에 들어올 때마다 due 목록을 받는다. 세션을 마치고 "다시 하기"로
  // 돌아오면 방금 채점한 결과가 반영된 목록을 다시 받게 된다.
  useEffect(() => {
    if (phase !== "setup") return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(undefined);
      try {
        const token = await getToken();
        if (!token) throw new Error("로그인이 필요합니다.");
        const [dueResult, dueCounts] = await Promise.all([
          fetchDueWords(token, MAX_COUNT),
          fetchDueCounts(token),
        ]);
        if (cancelled) return;

        const cards = dueResult.cards;
        setDue(cards);
        setCounts(dueCounts);
        // 기본값 20이 due 개수보다 크면 개수에 맞춘다.
        setCountText((prev) => {
          const n = Number.parseInt(prev, 10);
          const wanted = Number.isNaN(n) ? 20 : n;
          return String(Math.max(1, Math.min(wanted, cards.length)));
        });
      } catch (reason) {
        if (cancelled) return;
        setError(
          reason instanceof Error ? reason.message : "단어를 불러오지 못했어요.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, getToken]);

  /** 버튼에 띄울 다음 간격. 카드마다 서버가 계산해 실어 보낸다. */
  function delaysFor(card: DueCard): { again: string; good: string } {
    return {
      again: formatDelay(card.preview.againSeconds),
      good: formatDelay(card.preview.goodSeconds),
    };
  }

  function toggleBook(bookId: string) {
    setSelectedBookIds((prev) => {
      const base = prev ?? wordBooks.map((book) => book.id);
      return base.includes(bookId)
        ? base.filter((id) => id !== bookId)
        : [...base, bookId];
    });
  }

  // 위에서 받아둔 목록을 그대로 쓴다. due는 오래 밀린 순이라 앞에서 size개를
  // 자르면 앱과 같은 "오래 밀린 순 N개"가 된다.
  function start() {
    if (!due || size < 1 || loading) return;

    pending.current = [];
    sent.current = false;
    // 무엇을 낼지는 항상 오래 밀린 순으로 고른다 — 섞는 것은 그 안의 순서뿐이다.
    const chosen = picked.slice(0, size);
    setQueue(shuffle ? shuffled(chosen) : chosen);
    setSessionSize(chosen.length);
    setFinished(0);
    setIndex(0);
    setFlipped(false);
    setResult({ again: 0, good: 0 });
    setPhase(chosen.length === 0 ? "done" : "session");
  }

  function stop() {
    setPhase("done");
    void flush();
  }

  const delays = current ? delaysFor(current) : { again: "", good: "" };

  if (phase === "session" && current) {
    return (
      <main
        className={cn(SCREEN, "mx-auto flex w-full max-w-xl flex-col px-6 py-10")}
      >
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={stop}
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
            {finished} / {sessionSize}
          </span>
          {/* 어느 방향으로 묻는 카드인지. 기본 종류뿐이면 군더더기라 숨긴다. */}
          {kindLabel(current) ? (
            <span className="shrink-0 text-[11px] text-ink/35">
              {kindLabel(current)}
            </span>
          ) : null}
          <div className="h-px flex-1 bg-taupe/50">
            <div
              className="h-px bg-ink transition-all duration-200"
              style={{
                width: `${sessionSize === 0 ? 0 : (finished / sessionSize) * 100}%`,
              }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setFlipped((prev) => !prev)}
          className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-6 text-center"
        >
          <p
            className={cn(
              "font-semibold tracking-tight text-ink",
              // 빈칸은 문장 한 덩이라 단어와 같은 크기로 두면 넘친다.
              current.sourceType === "cloze"
                ? "text-2xl leading-relaxed"
                : "text-4xl",
            )}
          >
            {front(current)}
          </p>

          {flipped ? (
            <div className="space-y-3">
              {current.word?.pronunciation ? (
                <p className="text-base text-ink/45">
                  {current.word.pronunciation}
                </p>
              ) : null}
              <p className="text-2xl text-ink">{back(current)}</p>
              {current.word?.example ? (
                <p className="pt-4 text-base text-ink/55">
                  {current.word.example}
                </p>
              ) : null}
              {current.word?.exampleMeaning ? (
                <p className="text-sm text-ink/40">
                  {current.word.exampleMeaning}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-ink/25">
              {current.sourceType === "cloze"
                ? "눌러서 답 보기"
                : current.kind === "recall"
                  ? "눌러서 단어 보기"
                  : "눌러서 뜻 보기"}
            </p>
          )}
        </button>

        {/* 안키가 버튼 위에 <1m / <10m를 띄우는 것과 같다. 계산은 서버가 한다. */}
        <div className="mb-1.5 grid grid-cols-2 gap-2.5 text-center text-[11px] tabular-nums text-ink/35">
          <span>{delays.again}</span>
          <span>{delays.good}</span>
        </div>

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
    const total = result.again + result.good;
    return (
      <main
        className={cn(
          SCREEN,
          "mx-auto flex w-full max-w-xl flex-col items-center justify-center px-6 py-14 text-center",
        )}
      >
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {total === 0 ? "오늘 복습할 단어가 없습니다" : "테스트 완료"}
        </h1>

        {total > 0 ? (
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
        ) : (
          <p className="mt-3 text-sm text-ink/40">
            다음 복습 시각이 될 때까지 기다려 주세요
          </p>
        )}

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
      <p aria-hidden className="text-lg text-ink/75">
        /ᐠ .⑅.ᐟ\ﾉ
      </p>

      <h1 className="mt-5 flex items-center justify-center gap-2.5 text-2xl font-semibold tracking-tight text-ink">
        {/* 픽셀 폰트는 한자·한글이 없다 — 이 가나 문구에만 쓴다 */}
        <span className="font-pixel text-xl">テスト</span>
        <span>테스트</span>
      </h1>

      <p className="mt-3 text-sm text-ink/40">
        {loading ? (
          "단어를 세는 중이냥"
        ) : dueCount === 0 ? (
          "오늘은 복습할 단어가 없다냥"
        ) : (
          <>
            복습할 때가 된 단어{" "}
            <span className="font-semibold tabular-nums text-ink">
              {dueCount}
            </span>
            개가 기다리는 중이냥
          </>
        )}
      </p>

      {showBookPicker ? (
        <div className="mt-8 flex max-w-lg flex-wrap items-center justify-center gap-2">
          {wordBooks.map((book) => {
            const n = counts?.byBook[book.id] ?? 0;
            const on = selected.includes(book.id);
            return (
              <SubtleButton
                key={book.id}
                onClick={() => toggleBook(book.id)}
                aria-pressed={on}
                className={cn(
                  "px-3.5 py-1.5 text-xs",
                  // 0개여도 누를 수 있어야 한다 — 막아두면 고장처럼 보인다.
                  n === 0 && "opacity-50",
                  on && "border-ink bg-ink text-cream hover:text-cream",
                )}
              >
                <span className="max-w-[9rem] truncate">{book.title}</span>
                <span className="ml-1.5 tabular-nums opacity-60">{n}</span>
              </SubtleButton>
            );
          })}
        </div>
      ) : null}

      <div className="mt-12 flex items-end justify-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={limit}
          value={countText}
          onChange={(e) => setCountText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void start();
          }}
          aria-label="출제할 단어 개수"
          className="w-28 border-b border-taupe/60 bg-transparent pb-1.5 text-center text-4xl font-semibold tabular-nums text-ink outline-none transition focus:border-ink"
        />
        <span className="pb-2.5 text-sm text-ink/35">개</span>
      </div>

      <input
        type="range"
        min={1}
        max={limit}
        value={size || 1}
        onChange={(e) => setCountText(e.target.value)}
        aria-label="출제할 단어 개수 조절"
        className="mt-9 h-1 w-full max-w-xs cursor-pointer accent-ink"
      />

      <SubtleButton
        onClick={() => setShuffle((prev) => !prev)}
        aria-pressed={shuffle}
        className={cn(
          "mt-9 px-3.5 py-1.5 text-xs",
          shuffle && "border-ink bg-ink text-cream hover:text-cream",
        )}
      >
        {shuffle ? "랜덤 섞기 ON" : "랜덤 섞기"}
      </SubtleButton>

      {error ? <p className="mt-8 text-sm text-red-700">{error}</p> : null}

      <PrimaryButton
        onClick={start}
        disabled={!due || size < 1 || loading || picked.length === 0}
        className="mt-12 gap-2 px-7 py-2.5"
      >
        {loading ? "불러오는 중…" : "시작하기"}
        {loading ? null : <span aria-hidden>→</span>}
      </PrimaryButton>
    </main>
  );
}
