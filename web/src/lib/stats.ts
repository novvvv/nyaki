import { activeWords, bookMeta } from "./vocab-store";
import type { Word, WordBook } from "./types";

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

/**
 * 단어장 암기율 — 앱 '정보' 탭과 같은 계산이다.
 * 구현 원본: lib/screens/word_book/word_book_detail_screen.dart `_WordBookInfoView`
 *
 * 단어 1개 점수 = log(1 + 간격일) / log(1 + 30) × 100.
 * SM-2 간격이 1 → 3 → 8 → 20 → 50일로 지수적으로 늘어나므로 로그로 환산해야
 * 단계가 20 / 40 / 64 / 89 / 100으로 고르게 벌어진다. 선형이면 첫 성공이 3점이다.
 *
 * 단어장 암기율 = 그 점수들의 평균. 이름이 "단어장"이므로 분모는 단어 전체,
 * 즉 아직 학습 안 한 단어도 0점으로 포함된다.
 *
 * **앱 코드를 고치면 여기도 같이 고쳐야 한다** — 같은 단어장이 기기마다
 * 다른 암기율로 보이면 사용자가 바로 알아챈다.
 */

/** 이 간격(일)에 도달하면 만점. */
const MASTERY_DAYS = 30;

/** 단어 1개의 점수(0~100). */
export function wordScore(word: Word): number {
  const days = word.srsIntervalDays ?? 0;
  if (days <= 0) return 0;
  const ratio = Math.log(1 + days) / Math.log(1 + MASTERY_DAYS);
  return Math.round(Math.min(ratio, 1) * 100);
}

/** 단어장 암기율(0~100). 단어가 없으면 0. */
export function computeMasteryRate(book: WordBook): number {
  const words = activeWords(book);
  if (words.length === 0) return 0;
  const total = words.reduce((sum, word) => sum + wordScore(word), 0);
  return Math.round(total / words.length);
}

export interface MasteryRow {
  id: string;
  title: string;
  /** 0~100 */
  rate: number;
  wordCount: number;
}

/**
 * 단어장별 암기율, 높은 순.
 *
 * 단어가 0개인 단어장은 뺀다 — 분모가 0이라 0%로 그리면 "다 잊었다"처럼 보인다.
 */
export function computeMasteryByBook(wordBooks: WordBook[]): MasteryRow[] {
  return wordBooks
    .map((book) => ({
      id: book.id,
      title: book.title,
      rate: computeMasteryRate(book),
      wordCount: activeWords(book).length,
    }))
    .filter((row) => row.wordCount > 0)
    .sort((a, b) => b.rate - a.rate);
}
