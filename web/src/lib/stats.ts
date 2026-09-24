import type { BookSummary, DailyAdded } from "./api-client";
import { activeWords, bookMeta } from "./vocab-store";
import type { WordBook } from "./types";

export interface OverviewSummary {
  totalBooks: number;
  /** 단어 + 빈칸 노트. 서버가 센 값이다. */
  totalItems: number;
  bookmarkedCount: number;
}

export interface DailyCount {
  /** YYYY-MM-DD, KST(로컬) 기준 */
  date: string;
  count: number;
}

export interface BookComparisonRow {
  id: string;
  title: string;
  wordCount: number;
  memorizedRate: number;
  bookmarkedCount: number;
}

export type RangePreset = 7 | 30 | 90 | "all";

/**
 * 전체 단어장 통합 요약 수치.
 *
 * 개수는 **서버가 센 집계**를 쓴다. 여기서 wordBooks의 words를 세면 빈칸 노트가
 * 통째로 빠져서, 같은 단어장이 상세 화면과 다른 숫자로 보인다.
 * 즐겨찾기는 단어에만 있는 값이라 그대로 단어에서 센다.
 */
export function computeOverviewSummary(
  wordBooks: WordBook[],
  summaries: Record<string, BookSummary>,
): OverviewSummary {
  const allWords = wordBooks.flatMap((book) => activeWords(book));

  return {
    totalBooks: wordBooks.length,
    totalItems: wordBooks.reduce(
      (sum, book) => sum + (summaries[book.id]?.itemCount ?? 0),
      0,
    ),
    bookmarkedCount: allWords.filter((word) => word.isBookmarked).length,
  };
}

function toDateKey(date: Date): string {
  // 로컬 날짜로 자른다. 서버도 같은 시차를 받아 같은 규칙으로 묶는다.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 서버가 준 날짜별 개수에 **빈 날짜를 0으로 채운다.**
 *
 * 세는 일은 서버가 한다 — 단어만 세면 빈칸 노트가 통째로 빠지고, 노트를 전부
 * 받아와서 세면 문장까지 실어 나르게 된다. 여기서는 차트가 날짜를 건너뛰지
 * 않도록 사이를 메우기만 한다. "오늘"이 며칠인지는 브라우저가 안다.
 *
 * [range]가 숫자면 오늘부터 range일 전까지, "all"이면 가장 오래된 날부터 오늘까지.
 */
export function fillDailyCounts(
  rows: DailyAdded[],
  range: RangePreset,
): DailyCount[] {
  const counts = new Map(rows.map((row) => [row.date, row.count]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let start: Date;
  if (range === "all") {
    if (rows.length === 0) return [];
    // 서버가 날짜 순으로 주지만, 정렬에 기대지 않고 가장 이른 날을 찾는다.
    const oldest = rows.reduce(
      (min, row) => (row.date < min ? row.date : min),
      rows[0].date,
    );
    // "2026-09-23" 그대로 new Date()에 넣으면 UTC 자정으로 읽혀 하루 밀린다.
    const [y, m, d] = oldest.split("-").map(Number);
    start = new Date(y, m - 1, d);
  } else {
    start = new Date(today);
    start.setDate(start.getDate() - (range - 1));
  }

  const days: DailyCount[] = [];
  for (
    const cursor = new Date(start);
    cursor.getTime() <= today.getTime();
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const key = toDateKey(cursor);
    days.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return days;
}

/** 단어장별 비교 표 — 단어 수 많은 순으로 정렬. */
export function computeBookComparison(
  wordBooks: WordBook[],
): BookComparisonRow[] {
  return wordBooks
    .map((book) => {
      const meta = bookMeta(book);
      return {
        id: book.id,
        title: book.title,
        wordCount: meta.count,
        memorizedRate: meta.rate,
        bookmarkedCount: activeWords(book).filter((word) => word.isBookmarked)
          .length,
      };
    })
    .sort((a, b) => b.wordCount - a.wordCount);
}

export interface MasteryRow {
  id: string;
  title: string;
  /** 0~100 */
  rate: number;
  itemCount: number;
}

/**
 * 단어장별 암기율, 높은 순.
 *
 * 암기율과 개수 모두 서버 집계를 그대로 쓴다. 암기율의 분모는 **카드**다 —
 * 단어의 srs 값으로 계산하면 빈칸 카드도, 같은 단어의 recall 카드도 빠진다.
 *
 * 항목이 0개인 단어장은 뺀다 — 분모가 0이라 0%로 그리면 "다 잊었다"처럼 보인다.
 */
export function computeMasteryByBook(
  wordBooks: WordBook[],
  summaries: Record<string, BookSummary>,
): MasteryRow[] {
  return wordBooks
    .map((book) => ({
      id: book.id,
      title: book.title,
      rate: summaries[book.id]?.masteryRate ?? 0,
      itemCount: summaries[book.id]?.itemCount ?? 0,
    }))
    .filter((row) => row.itemCount > 0)
    .sort((a, b) => b.rate - a.rate);
}
