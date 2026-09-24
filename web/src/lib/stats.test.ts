import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  computeMasteryByBook,
  computeOverviewSummary,
  fillDailyCounts,
} from "./stats";
import type { BookSummary } from "./api-client";
import type { Word, WordBook } from "./types";

const NOW = "2026-09-23T12:00:00.000Z";

function word(overrides: Partial<Word> = {}): Word {
  return {
    id: "w1",
    wordBookId: "b1",
    term: "cat",
    meaning: "고양이",
    memorizationStatus: "unmemorized",
    isBookmarked: false,
    tags: [],
    createdAt: NOW,
    updatedAt: NOW,
    isDeleted: false,
    ...overrides,
  };
}

/**
 * 집계는 서버가 센다 — 웹은 받은 값을 늘어놓기만 한다.
 * 그래서 여기서도 서버 응답을 흉내 낸 값을 넣는다.
 */
function summary(
  wordBookId: string,
  itemCount: number,
  masteryRate: number,
): BookSummary {
  return { wordBookId, itemCount, cardCount: itemCount, masteryRate };
}

function book(words: Word[], overrides: Partial<WordBook> = {}): WordBook {
  return {
    id: "b1",
    title: "냐키",
    createdAt: NOW,
    updatedAt: NOW,
    words,
    ...overrides,
  };
}

describe("computeMasteryByBook — 단어장별 비교", () => {
  it("암기율 높은 순으로 정렬한다", () => {
    const rows = computeMasteryByBook(
      [
        book([word({ id: "a" })], { id: "low", title: "낮음" }),
        book([word({ id: "b" })], { id: "high", title: "높음" }),
      ],
      { low: summary("low", 1, 20), high: summary("high", 1, 100) },
    );

    expect(rows.map((row) => row.id)).toEqual(["high", "low"]);
    expect(rows[0]).toMatchObject({ rate: 100, itemCount: 1, title: "높음" });
  });

  it("빈칸 노트만 있는 단어장도 나온다 — 단어 배열은 비어 있다", () => {
    // 웹 스토어의 words에는 빈칸 노트가 없다. 서버 집계를 안 쓰면 통째로 빠진다.
    const rows = computeMasteryByBook([book([], { id: "cloze-only" })], {
      "cloze-only": summary("cloze-only", 2, 55),
    });

    expect(rows).toEqual([
      { id: "cloze-only", title: "냐키", rate: 55, itemCount: 2 },
    ]);
  });

  it("항목이 없는 단어장은 뺀다 — 0%로 그리면 '다 잊었다'처럼 읽힌다", () => {
    const rows = computeMasteryByBook(
      [book([], { id: "empty" }), book([word()], { id: "filled" })],
      { empty: summary("empty", 0, 0), filled: summary("filled", 1, 40) },
    );

    expect(rows.map((row) => row.id)).toEqual(["filled"]);
  });
});

describe("computeOverviewSummary — 전체 요약", () => {
  it("단어장 수·항목 수·즐겨찾기를 센다", () => {
    const result = computeOverviewSummary(
      [
        book([
          word({ id: "a", isBookmarked: true }),
          word({ id: "b" }),
          word({ id: "c", isDeleted: true }),
        ]),
        book([word({ id: "d", isBookmarked: true })], { id: "b2" }),
      ],
      // b1은 단어 2 + 빈칸 노트 1, b2는 단어 1.
      { b1: summary("b1", 3, 0), b2: summary("b2", 1, 0) },
    );

    expect(result.totalBooks).toBe(2);
    expect(result.totalItems).toBe(4); // 빈칸 노트 포함, 삭제된 것 제외
    expect(result.bookmarkedCount).toBe(2);
  });
});

describe("fillDailyCounts — 빈 날짜 메우기", () => {
  // 세는 일은 서버가 한다. 여기서 검증하는 것은 "사이를 0으로 메운다"뿐이다.
  beforeEach(() => {
    vi.useFakeTimers();
    // 로컬 시각으로 못 박는다 — 날짜 경계가 시차에 따라 달라지면 안 된다.
    vi.setSystemTime(new Date(2026, 8, 23, 12, 0, 0)); // 2026-09-23
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("오늘까지 range일을 채우고, 값 없는 날은 0으로 둔다", () => {
    const rows = fillDailyCounts([{ date: "2026-09-21", count: 4 }], 3);

    expect(rows).toEqual([
      { date: "2026-09-21", count: 4 },
      { date: "2026-09-22", count: 0 },
      { date: "2026-09-23", count: 0 },
    ]);
  });

  it("창 밖의 날짜는 무시한다 — 서버가 걸러도 한 번 더 막는다", () => {
    const rows = fillDailyCounts(
      [
        { date: "2026-08-01", count: 9 },
        { date: "2026-09-23", count: 1 },
      ],
      2,
    );

    expect(rows).toEqual([
      { date: "2026-09-22", count: 0 },
      { date: "2026-09-23", count: 1 },
    ]);
  });

  it("'all'이면 가장 오래된 날부터 오늘까지", () => {
    const rows = fillDailyCounts([{ date: "2026-09-20", count: 2 }], "all");

    expect(rows.map((row) => row.date)).toEqual([
      "2026-09-20",
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
    ]);
    expect(rows[0].count).toBe(2);
  });

  it("'all'인데 데이터가 없으면 빈 배열 — 0만 늘어선 차트를 그리지 않는다", () => {
    expect(fillDailyCounts([], "all")).toEqual([]);
  });

  it("날짜 문자열을 UTC로 읽어 하루 밀리지 않는다", () => {
    // new Date("2026-09-20")은 UTC 자정이라 KST에서 09-20 09:00,
    // 음수 시차 지역에서는 09-19가 된다. 그래서 직접 쪼개 읽는다.
    const rows = fillDailyCounts([{ date: "2026-09-22", count: 1 }], "all");
    expect(rows[0]).toEqual({ date: "2026-09-22", count: 1 });
  });
});
