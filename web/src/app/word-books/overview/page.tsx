"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { MasteryByBook } from "@/components/charts/mastery-by-book";
import { WordAddedTrend } from "@/components/charts/word-added-trend";
import { Card, PageHeader } from "@/components/ui";
import {
  fetchDailyAdded,
  fetchDailyReviewed,
  fetchMasteryHistory,
  type DailyAdded,
  type DailyReviewed,
  type MasteryPoint,
} from "@/lib/api-client";
import {
  computeMasteryByBook,
  computeOverviewSummary,
  fillDailyCounts,
  type RangePreset,
} from "@/lib/stats";
import { useAppMode } from "@/lib/app-mode";
import { useNyakiImage } from "@/lib/nyaki-skin";
import { cn } from "@/lib/utils";
import { useVocab } from "@/lib/vocab-store";

/** "복습한 단어" 차트 기간(일) */
const REVIEW_DAYS = 30;

/**
 * "복습한 단어" 차트가 세는 것. 카드 수는 같은 카드를 하루에 여러 번 봐도 1개,
 * 넘긴 횟수는 채점한 만큼 센다.
 */
type ReviewMetric = "cards" | "reviews";

const REVIEW_METRICS: { key: ReviewMetric; label: string }[] = [
  { key: "cards", label: "카드 수" },
  { key: "reviews", label: "넘긴 횟수" },
];

const RANGE_OPTIONS: { key: RangePreset; label: string }[] = [
  { key: 7, label: "7일" },
  { key: 30, label: "30일" },
  { key: 90, label: "90일" },
  { key: "all", label: "전체" },
];

export default function OverviewPage() {
  const { wordBooks, summaries, loading, error } = useVocab();
  const { getToken } = useAuth();
  const [range, setRange] = useState<RangePreset>(30);
  const [added, setAdded] = useState<DailyAdded[]>([]);
  const [reviewed, setReviewed] = useState<DailyReviewed[]>([]);
  const [reviewMetric, setReviewMetric] = useState<ReviewMetric>("cards");
  const [masteryHistory, setMasteryHistory] =
    useState<Record<string, MasteryPoint[]>>();
  const appMode = useAppMode();

  // 날짜별 개수는 서버가 센다 — 단어와 빈칸 노트를 함께 세려면 여기서는 셀 수 없다.
  // 이펙트 본문에서 곧바로 setState가 일어나지 않도록 async 블록으로 감싼다
  // (react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const rows = await fetchDailyAdded(
          token,
          range === "all" ? undefined : range,
        );
        if (!cancelled) setAdded(rows);
      } catch {
        // 차트 하나 때문에 화면 전체를 못 보게 만들지 않는다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, range, wordBooks]);

  // 복습한 카드 수 — 최근 30일 고정. 단어장을 바꾸면 복습 기록도 바뀔 수 있어
  // 단어장 목록이 바뀔 때 다시 받는다.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const rows = await fetchDailyReviewed(token, REVIEW_DAYS);
        if (!cancelled) setReviewed(rows);
      } catch {
        // 차트 하나 때문에 화면 전체를 못 보게 만들지 않는다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, wordBooks]);

  // 암기율 곡선 — 최근 30일 날짜별. 복습 기록과 같이 단어장 목록이 바뀌면 다시 받는다.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const rows = await fetchMasteryHistory(token, REVIEW_DAYS);
        if (!cancelled) setMasteryHistory(rows);
      } catch {
        // 차트 하나 때문에 화면 전체를 못 보게 만들지 않는다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, wordBooks]);

  const summary = useMemo(
    () => computeOverviewSummary(wordBooks, summaries),
    [wordBooks, summaries],
  );
  const mastery = useMemo(
    () => computeMasteryByBook(wordBooks, summaries),
    [wordBooks, summaries],
  );
  const dailyCounts = useMemo(
    () => fillDailyCounts(added, range),
    [added, range],
  );
  const reviewCounts = useMemo(
    () =>
      fillDailyCounts(
        reviewed.map((row) => ({
          date: row.date,
          // 예전 서버는 넘긴 횟수를 안 보낸다 — 그때는 카드 수로 둔다.
          count: reviewMetric === "reviews" ? (row.reviews ?? row.count) : row.count,
        })),
        REVIEW_DAYS,
      ),
    [reviewed, reviewMetric],
  );
  // 빈 날짜까지 채운 목록의 마지막 칸이 오늘이다.
  const reviewedToday = reviewCounts.at(-1)?.count ?? 0;
  // 앱 머리 카드 — 최근 30일 동안 복습한 카드와 공부한 날.
  const reviewedMonth = reviewed.reduce((sum, row) => sum + row.count, 0);
  const studyDays = reviewed.filter((row) => row.count > 0).length;
  // 앱에서는 카드를 더 둥글게 — 오늘 · 단어장 화면의 타일과 맞춘다.
  const cardClass = cn("px-5 py-5", appMode && "rounded-3xl border-taupe/70 px-4");

  return (
    <main className="mx-auto w-full max-w-6xl px-8 py-14 lg:px-12">
      {appMode ? (
        <AppHeader
          reviewedToday={reviewedToday}
          reviewedMonth={reviewedMonth}
          studyDays={studyDays}
        />
      ) : (
        <PageHeader title="전체 통계" description="모든 단어장을 합친 추이예요." />
      )}

      {error ? <p className="mb-6 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-umber/40">불러오는 중…</p>
      ) : wordBooks.length === 0 ? (
        <p className="text-sm text-umber/40">
          단어장을 먼저 만들면 여기에 통계가 표시돼요.
        </p>
      ) : (
        <div className={appMode ? "space-y-4" : "space-y-8"}>
          <dl className={cn("grid grid-cols-3", appMode ? "gap-2" : "gap-3")}>
            <StatTile app={appMode} label="단어장" value={summary.totalBooks} />
            <StatTile app={appMode} label="전체 항목" value={summary.totalItems} />
            <StatTile app={appMode} label="즐겨찾기" value={summary.bookmarkedCount} />
          </dl>

          <Card className={cardClass}>
            <Choices
              app={appMode}
              options={RANGE_OPTIONS}
              value={range}
              onChange={setRange}
            />
            <WordAddedTrend data={dailyCounts} shapeToggle />
          </Card>

          <Card className={cardClass}>
            <MasteryByBook data={mastery} history={masteryHistory} />
          </Card>

          <Card className={cardClass}>
            <Choices
              app={appMode}
              options={REVIEW_METRICS}
              value={reviewMetric}
              onChange={setReviewMetric}
            />
            <WordAddedTrend
              data={reviewCounts}
              title="복습한 단어"
              valueLabel={reviewMetric === "reviews" ? "넘긴 횟수" : "복습한 단어"}
              ariaLabel={
                reviewMetric === "reviews"
                  ? "최근 30일 날짜별 넘긴 횟수"
                  : "최근 30일 날짜별 복습한 단어 수"
              }
              note={
                reviewMetric === "reviews"
                  ? `오늘 ${reviewedToday}번`
                  : `오늘 ${reviewedToday}개`
              }
              unit={reviewMetric === "reviews" ? "번" : "개"}
              highlightLast
              shapeToggle
            />
          </Card>
        </div>
      )}
    </main>
  );
}

/**
 * 차트 위 고르기 버튼(기간 · 세는 기준). 웹은 글자만, 앱은 알약 모양 묶음이다.
 */
function Choices<T extends string | number>({
  app,
  options,
  value,
  onChange,
}: {
  app: boolean;
  options: { key: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      className={cn(
        "mb-4 flex items-center",
        app ? "w-fit gap-0.5 rounded-full bg-subtle p-1" : "gap-3.5",
      )}
    >
      {options.map((opt) => {
        const on = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            aria-pressed={on}
            className={cn(
              "text-xs transition",
              app && "rounded-full px-3 py-1",
              on
                ? cn("font-semibold text-ink", app && "bg-cream shadow-sm")
                : "font-medium text-umber/45 hover:text-umber/70",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** 앱의 통계 머리 — 제목과 분홍 카드(오늘 · 최근 30일 복습). */
function AppHeader({
  reviewedToday,
  reviewedMonth,
  studyDays,
}: {
  reviewedToday: number;
  reviewedMonth: number;
  studyDays: number;
}) {
  const nyaki = useNyakiImage();
  return (
    <div className="mb-4">
      <h1 className="text-[22px] font-bold tracking-tight text-ink">통계</h1>
      <p className="mt-1 text-xs text-ink/45">모든 단어장을 합친 기록이에요.</p>
      <section className="relative mt-5 overflow-hidden rounded-3xl border border-ink/80 bg-[#f7e9e9] dark:bg-[#efd6d6]/15">
        <div className="relative z-10 p-5 pr-[40%]">
          <p className="text-xs font-medium text-ink/55">오늘 복습한 카드</p>
          <p className="mt-1 text-[34px] font-bold leading-none tracking-tight text-ink tabular-nums">
            {reviewedToday}
            <span className="ml-1 text-base font-semibold">개</span>
          </p>
          <div className="mt-4 flex gap-5 text-xs text-ink/55">
            <div>
              <p>최근 30일</p>
              <p className="mt-0.5 text-sm font-semibold text-ink tabular-nums">
                {reviewedMonth}개
              </p>
            </div>
            <div>
              <p>공부한 날</p>
              <p className="mt-0.5 text-sm font-semibold text-ink tabular-nums">
                {studyDays}일
              </p>
            </div>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={nyaki("happy")}
          alt=""
          width={900}
          height={1206}
          className="pointer-events-none absolute -bottom-8 -right-2 w-[42%] max-w-[170px]"
        />
      </section>
    </div>
  );
}

function StatTile({
  app,
  label,
  value,
  suffix,
}: {
  app: boolean;
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <Card className={cn("px-4 py-3.5", app && "rounded-2xl border-taupe/70 px-3.5")}>
      <dt className="text-xs text-umber/50">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">
        {value}
        {suffix ?? ""}
      </dd>
    </Card>
  );
}
