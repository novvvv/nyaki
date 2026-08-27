import { activeWords, bookMeta } from "./vocab-store";
import type { WordBook } from "./types";

export interface OverviewSummary {
  totalBooks: number;
  totalWords: number;
  memorizedRate: number;
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

/** 전체 단어장 통합 요약 수치. */
export function computeOverviewSummary(
  wordBooks: WordBook[],
): OverviewSummary {
  const allWords = wordBooks.flatMap((book) => activeWords(book));
  const totalWords = allWords.length;
  const memorized = allWords.filter(
    (word) => word.memorizationStatus === "memorized",
  ).length;
  const bookmarkedCount = allWords.filter((word) => word.isBookmarked).length;

  return {
    totalBooks: wordBooks.length,
    totalWords,
    memorizedRate:
      totalWords === 0 ? 0 : Math.round((memorized / totalWords) * 100),
    bookmarkedCount,
  };
}

function toDateKey(iso: string): string {
  // createdAt은 서버가 내려주는 ISO 문자열. 날짜만 로컬 기준으로 자른다.
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 날짜별 단어 추가 개수. [range]가 숫자면 "오늘부터 range일 전"까지,
 * "all"이면 가장 오래된 단어부터 오늘까지 — 데이터 없는 날짜도 0으로
 * 채워서 반환한다(차트가 빈 날짜를 건너뛰지 않도록).
 */
export function computeDailyWordCounts(
  wordBooks: WordBook[],
  range: RangePreset,
): DailyCount[] {
  const allWords = wordBooks.flatMap((book) => activeWords(book));
  const counts = new Map<string, number>();
  for (const word of allWords) {
    const key = toDateKey(word.createdAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let start: Date;
  if (range === "all") {
    if (allWords.length === 0) {
      return [];
    }
    const oldest = allWords.reduce(
      (min, word) => Math.min(min, new Date(word.createdAt).getTime()),
      Date.now(),
    );
    start = new Date(oldest);
    start.setHours(0, 0, 0, 0);
  } else {
    start = new Date(today);
    start.setDate(start.getDate() - (range - 1));
  }

  const days: DailyCount[] = [];
  for (
    let cursor = new Date(start);
    cursor.getTime() <= today.getTime();
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const key = toDateKey(cursor.toISOString());
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
