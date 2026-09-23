"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { PrimaryButton, SubtleButton } from "@/components/ui";
import {
  fetchDueCounts,
  fetchDueWords,
  fetchProgress,
  pushGrades,
  pushGradesBeacon,
  type DueCounts,
  type GradePreview,
  type Progress,
  type ReviewGrade,
  type ReviewGradeItem,
} from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { Word } from "@/lib/types";
import { useVocab } from "@/lib/vocab-store";

type Phase = "setup" | "session" | "done";

const SCREEN = "min-h-[calc(100vh-8.5rem)]";
// 서버 /v1/review/due의 상한과 같다. 실제 출제량은 하루 한도(마이페이지)와
// 오늘 due인 단어 수가 정한다 — 이 값은 그 위에 얹힌 안전장치일 뿐이다.
const MAX_COUNT = 9999;

/** 초 → 사람이 읽는 간격. 버튼 위에 띄운다. */
function formatDelay(seconds: number): string {
  if (seconds <= 30) return "즉시";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}시간`;
  return `${Math.round(seconds / 86400)}일`;
}


/** Fisher-Yates. 원본은 건드리지 않는다. */
function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function ReviewPage() {
  const { getToken } = useAuth();
  const { wordBooks } = useVocab();

  const [phase, setPhase] = useState<Phase>("setup");
  const [countText, setCountText] = useState("20");
  const [queue, setQueue] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [result, setResult] = useState({ again: 0, good: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  // 복습 주기가 돌아온 단어. 시작 화면의 상한이자 그대로 세션의 출제 목록이 된다.
  const [due, setDue] = useState<Word[]>();
  const [shuffle, setShuffle] = useState(false);
  // 단어장별 due 개수. /review/due(최대 200개)의 길이로 세면 201개부터 틀려서
  // 개수 전용 엔드포인트를 따로 부른다.
  const [counts, setCounts] = useState<DueCounts>();
  // 복습 흐름 설정. 세션 안에서 카드를 다시 보여줄지 정하는 데만 쓴다 —
  // 실제 다음 복습 시각은 서버가 계산한다.
  const [flow, setFlow] = useState<Progress>();
  // 단어 id → 버튼에 띄울 다음 간격. 서버가 계산해 내려준 값이다.
  const [previews, setPreviews] = useState<Record<string, GradePreview>>({});
  // 이 세션 동안 각 단어가 몇 번째 단계인지. 버튼의 예상 간격이 이 값을 읽으므로
  // ref가 아니라 상태로 둔다 — 렌더 중에 ref를 읽으면 갱신이 반영되지 않는다.
  const [sessionSteps, setSessionSteps] = useState<Record<string, number>>({});
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
  const picked = (due ?? []).filter((word) => isSelected(word.wordBookId));
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
      const word = queue[index];
      if (!word) return;

      pending.current.push({
        id: crypto.randomUUID(),
        wordId: word.id,
        grade: value,
        reviewedAt: new Date().toISOString(),
      });

      setResult((prev) => ({ ...prev, [value]: prev[value] + 1 }));
      setFlipped(false);

      // 학습 단계가 설정돼 있으면, 아직 졸업하지 않은 카드는 이 세션 안에서
      // 다시 보여준다. 몇 분 뒤인지는 서버가 정하고 여기서는 순서만 정한다 —
      // 웹은 SM-2를 계산하지 않는다(docs/WEB-REVIEW-PLAN.md 5절).
      //
      // 어느 단계 목록을 탈지는 "졸업한 적 있는 카드인가"로 가른다. 서버는
      // lapses로 판단하지만 여기서는 간격이 잡혀 있는지로 근사한다 — 틀려도
      // 이 세션의 등장 순서만 달라지고 저장되는 값은 서버 것이 맞는다.
      const steps =
        (word.srsIntervalDays ?? 0) > 0
          ? (flow?.relearningSteps ?? [])
          : (flow?.learningSteps ?? []);

      let requeued = false;
      if (steps.length > 0) {
        const current = sessionSteps[word.id] ?? word.srsLearningStep ?? 0;
        const nextStep = value === "again" ? 0 : current + 1;
        if (nextStep < steps.length) {
          setSessionSteps((prev) => ({ ...prev, [word.id]: nextStep }));
          requeued = true;
        }
      }

      if (requeued) setQueue((prev) => [...prev, word]);

      const next = index + 1;
      if (next >= queue.length + (requeued ? 1 : 0)) {
        setPhase("done");
        void flush();
      } else {
        setIndex(next);
      }
    },
    [flow, flush, index, queue, sessionSteps],
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
        const [due, dueCounts, progress] = await Promise.all([
          fetchDueWords(token, MAX_COUNT),
          fetchDueCounts(token),
          fetchProgress(token),
        ]);
        if (cancelled) return;

        const words = due.words;
        setPreviews(due.previews);
        setDue(words);
        setCounts(dueCounts);
        setFlow(progress);
        // 기본값 20이 due 개수보다 크면 개수에 맞춘다.
        setCountText((prev) => {
          const n = Number.parseInt(prev, 10);
          const wanted = Number.isNaN(n) ? 20 : n;
          return String(Math.max(1, Math.min(wanted, words.length)));
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

  /**
   * 버튼에 띄울 다음 간격.
   *
   * 서버가 세션 시작 때 계산해준 값을 쓴다. 다만 학습 단계 때문에 이 세션에서
   * 이미 채점한 카드는 그 값이 낡았으므로, 단계 목록으로 다시 만든다 —
   * 분 단위 단계는 SM-2 계산이 필요 없다.
   */
  function delaysFor(word: Word): { again: string; good: string } {
    const step = sessionSteps[word.id];
    const steps =
      (word.srsIntervalDays ?? 0) > 0
        ? (flow?.relearningSteps ?? [])
        : (flow?.learningSteps ?? []);

    if (step !== undefined && steps.length > 0) {
      const next = step + 1;
      return {
        again: `${steps[0]}분`,
        good:
          next < steps.length
            ? `${steps[next]}분`
            : `${flow?.graduatingIntervalDays ?? 1}일`,
      };
    }

    const preview = previews[word.id];
    if (!preview) return { again: "", good: "" };
    return {
      again: formatDelay(preview.againSeconds),
      good: formatDelay(preview.goodSeconds),
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
    setSessionSteps({});
    // 무엇을 낼지는 항상 오래 밀린 순으로 고른다 — 섞는 것은 그 안의 순서뿐이다.
    const chosen = picked.slice(0, size);
    setQueue(shuffle ? shuffled(chosen) : chosen);
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
                disabled={n === 0}
                aria-pressed={on}
                className={cn(
                  "px-3.5 py-1.5 text-xs",
                  on && n > 0 && "border-ink bg-ink text-cream hover:text-cream",
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
