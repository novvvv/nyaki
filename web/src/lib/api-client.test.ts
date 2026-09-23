import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchDueCounts,
  fetchDueWords,
  fetchProgress,
  pushGrades,
  updateSettings,
} from "./api-client";

/**
 * 서버 계약 검증.
 *
 * 서버는 snake_case, 웹은 camelCase다. 이 경계에서 필드를 하나 빠뜨리면
 * 화면에는 0이나 undefined가 조용히 흐른다 — 실제로 srs_interval_days가
 * 매핑에서 빠져 암기율이 전부 0으로 나온 적이 있다.
 */

const TOKEN = "test-token";

function mockJson(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockJson({}));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchDueWords", () => {
  it("단어와 버튼 예상 간격을 함께 돌려준다", async () => {
    vi.stubGlobal(
      "fetch",
      mockJson({
        words: [
          {
            id: "w1",
            word_book_id: "b1",
            term: "cat",
            meaning: "고양이",
            memorization_status: "memorized",
            is_bookmarked: true,
            tags: ["기초"],
            srs_interval_days: 8,
            srs_learning_step: null,
            created_at: "2026-09-01T00:00:00Z",
            updated_at: "2026-09-01T00:00:00Z",
            is_deleted: false,
          },
        ],
        previews: { w1: { again_seconds: 600, good_seconds: 1728000 } },
      }),
    );

    const result = await fetchDueWords(TOKEN, 30);

    expect(result.words[0]).toMatchObject({
      id: "w1",
      wordBookId: "b1",
      srsIntervalDays: 8,
      srsLearningStep: null,
      isBookmarked: true,
    });
    expect(result.previews.w1).toEqual({
      againSeconds: 600,
      goodSeconds: 1728000,
    });
  });

  it("limit을 쿼리로 보내고 토큰을 헤더에 싣는다", async () => {
    const fetchMock = mockJson({ words: [], previews: {} });
    vi.stubGlobal("fetch", fetchMock);

    await fetchDueWords(TOKEN, 42);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/v1/review/due?limit=42");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );
  });

  it("previews가 없는 응답도 견딘다 — 구버전 서버 호환", async () => {
    vi.stubGlobal("fetch", mockJson({ words: [] }));
    await expect(fetchDueWords(TOKEN, 10)).resolves.toMatchObject({
      previews: {},
    });
  });
});

describe("fetchDueCounts", () => {
  it("단어장별 개수를 camelCase로 바꾼다", async () => {
    vi.stubGlobal(
      "fetch",
      mockJson({ total: 12, by_book: { b1: 7, b2: 5 } }),
    );

    await expect(fetchDueCounts(TOKEN)).resolves.toEqual({
      total: 12,
      byBook: { b1: 7, b2: 5 },
    });
  });
});

describe("fetchProgress", () => {
  it("하루 한도와 복습 흐름을 함께 읽는다", async () => {
    vi.stubGlobal(
      "fetch",
      mockJson({
        churu_balance: 5,
        capelin_balance: 2,
        completed_today: ["pet_cat"],
        daily_new_limit: 10,
        daily_review_limit: 9999,
        learning_steps: [1, 10],
        relearning_steps: [10],
        graduating_interval_days: 1,
      }),
    );

    await expect(fetchProgress(TOKEN)).resolves.toEqual({
      churuBalance: 5,
      capelinBalance: 2,
      completedToday: ["pet_cat"],
      dailyNewLimit: 10,
      dailyReviewLimit: 9999,
      learningSteps: [1, 10],
      relearningSteps: [10],
      graduatingIntervalDays: 1,
    });
  });
});

describe("updateSettings", () => {
  it("보낸 항목만 본문에 담는다 — 나머지는 서버가 그대로 둔다", async () => {
    const fetchMock = mockJson({
      churu_balance: 0,
      capelin_balance: 0,
      completed_today: [],
      daily_new_limit: 25,
      daily_review_limit: 9999,
      learning_steps: [],
      relearning_steps: [],
      graduating_interval_days: 1,
    });
    vi.stubGlobal("fetch", fetchMock);

    await updateSettings(TOKEN, { dailyNewLimit: 25 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/v1/progress/settings");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ daily_new_limit: 25 });
  });

  it("빈 문자열도 그대로 보낸다 — '단계 끄기'를 뜻한다", async () => {
    const fetchMock = mockJson({
      churu_balance: 0,
      capelin_balance: 0,
      completed_today: [],
      daily_new_limit: 10,
      daily_review_limit: 9999,
      learning_steps: [],
      relearning_steps: [],
      graduating_interval_days: 1,
    });
    vi.stubGlobal("fetch", fetchMock);

    await updateSettings(TOKEN, { learningSteps: "" });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      learning_steps: "",
    });
  });
});

describe("pushGrades", () => {
  it("채점 묶음을 snake_case로 보낸다", async () => {
    const fetchMock = mockJson({ applied: 2, skipped: 0, missing: 0 });
    vi.stubGlobal("fetch", fetchMock);

    await pushGrades(TOKEN, [
      {
        id: "log-1",
        wordId: "w1",
        grade: "good",
        reviewedAt: "2026-09-23T12:00:00.000Z",
      },
      {
        id: "log-2",
        wordId: "w2",
        grade: "again",
        reviewedAt: "2026-09-23T12:00:05.000Z",
      },
    ]);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.grades).toHaveLength(2);
    expect(body.grades[0]).toEqual({
      id: "log-1",
      word_id: "w1",
      grade: "good",
      reviewed_at: "2026-09-23T12:00:00.000Z",
    });
  });

  it("서버가 실패를 주면 예외로 올린다 — 조용히 넘어가면 복습이 사라진다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ detail: "Not Found" }),
      }),
    );

    await expect(pushGrades(TOKEN, [])).rejects.toThrow("Not Found");
  });
});
