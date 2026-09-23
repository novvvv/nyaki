import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DueWords } from "@/lib/api-client";
import type { Word } from "@/lib/types";

/**
 * 복습 세션의 흐름.
 *
 * 여기서 지키는 것은 **한 카드는 세션에서 한 번만 나온다**와 **진행 표시의
 * 분모가 고정된다**이다. 예전에는 학습 단계를 켜면 채점한 카드를 대기열 뒤에
 * 다시 붙여서, 풀수록 전체 개수가 늘고 끝이 보이지 않았다.
 */

const pushGrades = vi.fn().mockResolvedValue({
  applied: 0,
  skipped: 0,
  missing: 0,
});
const fetchDueWords = vi.fn();
const fetchDueCounts = vi.fn();

vi.mock("@/lib/api-client", () => ({
  fetchDueWords: (...args: unknown[]) => fetchDueWords(...args),
  fetchDueCounts: (...args: unknown[]) => fetchDueCounts(...args),
  pushGrades: (...args: unknown[]) => pushGrades(...args),
  pushGradesBeacon: vi.fn(),
}));

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ getToken: async () => "test-token" }),
}));

vi.mock("@/lib/vocab-store", () => ({
  useVocab: () => ({ wordBooks: [{ id: "b1", title: "냐키", words: [] }] }),
}));

const NOW = "2026-09-24T00:00:00.000Z";

function word(id: string, term: string): Word {
  return {
    id,
    wordBookId: "b1",
    term,
    meaning: `${term} 뜻`,
    memorizationStatus: "unmemorized",
    isBookmarked: false,
    tags: [],
    srsIntervalDays: 0,
    srsLearningStep: null,
    createdAt: NOW,
    updatedAt: NOW,
    isDeleted: false,
  };
}

/** 학습 단계를 켠 상태를 흉내 낸다 — 모름 1분, 외움 10분. */
function dueWords(words: Word[]): DueWords {
  return {
    words,
    previews: Object.fromEntries(
      words.map((w) => [w.id, { againSeconds: 60, goodSeconds: 600 }]),
    ),
  };
}

async function startSession(user: ReturnType<typeof userEvent.setup>) {
  const { default: ReviewPage } = await import("./page");
  render(<ReviewPage />);

  const start = await screen.findByRole("button", { name: /시작하기/ });
  await waitFor(() => expect(start).not.toBeDisabled());
  await user.click(start);
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchDueWords.mockResolvedValue(
    dueWords([word("w1", "cat"), word("w2", "nap")]),
  );
  fetchDueCounts.mockResolvedValue({ total: 2, byBook: { b1: 2 } });
});

describe("복습 세션", () => {
  it("채점한 카드는 세션에서 다시 나오지 않는다", async () => {
    const user = userEvent.setup();
    await startSession(user);

    const first = screen.getByText(/cat|nap/).textContent;
    await user.click(screen.getByRole("button", { name: "모름" }));

    // 모름을 눌러도 같은 카드가 이어서 또 나오면 안 된다.
    const second = screen.getByText(/cat|nap/).textContent;
    expect(second).not.toBe(first);
  });

  it("진행 표시의 분모가 채점할수록 늘지 않는다", async () => {
    const user = userEvent.setup();
    await startSession(user);

    expect(screen.getByText("0 / 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "모름" }));
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("고른 개수만큼 채점하면 세션이 끝난다", async () => {
    const user = userEvent.setup();
    await startSession(user);

    await user.click(screen.getByRole("button", { name: "외움" }));
    await user.click(screen.getByRole("button", { name: "외움" }));

    expect(await screen.findByText("테스트 완료")).toBeInTheDocument();
  });

  it("채점 결과는 세션이 끝날 때 한 번에 보낸다", async () => {
    const user = userEvent.setup();
    await startSession(user);

    await user.click(screen.getByRole("button", { name: "외움" }));
    expect(pushGrades).not.toHaveBeenCalled(); // 카드마다 보내지 않는다

    await user.click(screen.getByRole("button", { name: "모름" }));

    await waitFor(() => expect(pushGrades).toHaveBeenCalledOnce());
    const [, grades] = pushGrades.mock.calls[0];
    expect(grades).toHaveLength(2);
    expect(grades.map((g: { grade: string }) => g.grade)).toEqual([
      "good",
      "again",
    ]);
  });

  it("버튼 위에 서버가 준 예상 간격을 띄운다", async () => {
    const user = userEvent.setup();
    await startSession(user);

    expect(screen.getByText("1분")).toBeInTheDocument();
    expect(screen.getByText("10분")).toBeInTheDocument();
  });

  it("복습할 단어가 없으면 시작 자체가 막힌다", async () => {
    fetchDueWords.mockResolvedValue(dueWords([]));
    fetchDueCounts.mockResolvedValue({ total: 0, byBook: {} });

    const { default: ReviewPage } = await import("./page");
    render(<ReviewPage />);

    expect(
      await screen.findByText("오늘은 복습할 단어가 없다냥"),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /시작하기/ })).toBeDisabled(),
    );
  });
});
