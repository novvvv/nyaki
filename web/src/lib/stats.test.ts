import { describe, expect, it } from "vitest";

import {
  computeMasteryByBook,
  computeMasteryRate,
  computeOverviewSummary,
  wordScore,
} from "./stats";
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

describe("wordScore — 단어 1개의 암기 점수", () => {
  // 앱 '정보' 탭(word_book_detail_screen.dart)의 주석에 적힌 값과 같아야 한다.
  // 같은 단어장이 기기마다 다른 암기율로 보이면 사용자가 바로 알아챈다.
  it.each([
    [0, 0],
    [1, 20],
    [3, 40],
    [8, 64],
    [20, 89],
    [30, 100],
  ])("간격 %i일 → %i점", (days, expected) => {
    expect(wordScore(word({ srsIntervalDays: days }))).toBe(expected);
  });

  it("만점 기준(30일)을 넘어도 100을 넘지 않는다", () => {
    expect(wordScore(word({ srsIntervalDays: 365 }))).toBe(100);
  });

  it("간격 필드가 없으면 0점 — 학습 단계 중인 카드가 여기 해당한다", () => {
    expect(wordScore(word())).toBe(0);
  });
});

describe("computeMasteryRate — 단어장 암기율", () => {
  it("점수들의 평균이다", () => {
    const rate = computeMasteryRate(
      book([
        word({ id: "a", srsIntervalDays: 30 }), // 100
        word({ id: "b", srsIntervalDays: 1 }), // 20
      ]),
    );
    expect(rate).toBe(60);
  });

  it("학습 안 한 단어도 0점으로 분모에 들어간다", () => {
    // 이름이 "단어장" 암기율이므로 분모는 단어 전체다.
    const rate = computeMasteryRate(
      book([
        word({ id: "a", srsIntervalDays: 30 }),
        word({ id: "b" }),
        word({ id: "c" }),
        word({ id: "d" }),
      ]),
    );
    expect(rate).toBe(25);
  });

  it("삭제된 단어는 빼고 센다", () => {
    const rate = computeMasteryRate(
      book([
        word({ id: "a", srsIntervalDays: 30 }),
        word({ id: "b", srsIntervalDays: 0, isDeleted: true }),
      ]),
    );
    expect(rate).toBe(100);
  });

  it("단어가 없으면 0", () => {
    expect(computeMasteryRate(book([]))).toBe(0);
  });
});

describe("computeMasteryByBook — 단어장별 비교", () => {
  it("암기율 높은 순으로 정렬한다", () => {
    const rows = computeMasteryByBook([
      book([word({ id: "a", srsIntervalDays: 1 })], { id: "low", title: "낮음" }),
      book([word({ id: "b", srsIntervalDays: 30 })], {
        id: "high",
        title: "높음",
      }),
    ]);

    expect(rows.map((row) => row.id)).toEqual(["high", "low"]);
    expect(rows[0]).toMatchObject({ rate: 100, wordCount: 1, title: "높음" });
  });

  it("단어가 없는 단어장은 뺀다 — 0%로 그리면 '다 잊었다'처럼 읽힌다", () => {
    const rows = computeMasteryByBook([
      book([], { id: "empty" }),
      book([word({ srsIntervalDays: 3 })], { id: "filled" }),
    ]);

    expect(rows.map((row) => row.id)).toEqual(["filled"]);
  });
});

describe("computeOverviewSummary — 전체 요약", () => {
  it("단어장 수·단어 수·즐겨찾기를 센다", () => {
    const summary = computeOverviewSummary([
      book([
        word({ id: "a", isBookmarked: true }),
        word({ id: "b" }),
        word({ id: "c", isDeleted: true }),
      ]),
      book([word({ id: "d", isBookmarked: true })], { id: "b2" }),
    ]);

    expect(summary.totalBooks).toBe(2);
    expect(summary.totalWords).toBe(3); // 삭제된 것 제외
    expect(summary.bookmarkedCount).toBe(2);
  });
});
