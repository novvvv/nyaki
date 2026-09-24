import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DueCard, DueWords } from "@/lib/api-client";
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
  useVocab: () => ({
    wordBooks: [
      { id: "b1", title: "냐키", words: [] },
      { id: "b2", title: "비어있음", words: [] },
    ],
  }),
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
function dueWords(
  words: Word[],
  kind: DueCard["kind"] = "recognition",
): DueWords {
  return {
    cards: words.map((word) => ({
      id: `${word.id}:${kind}`,
      kind,
      sourceType: "word" as const,
      wordBookId: word.wordBookId,
      word,
      preview: { againSeconds: 60, goodSeconds: 600 },
    })),
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

  it("채점에 card_id를 실어 보낸다 — 서버가 어느 카드인지 알아야 한다", async () => {
    const user = userEvent.setup();
    await startSession(user);

    await user.click(screen.getByRole("button", { name: "외움" }));
    await user.click(screen.getByRole("button", { name: "외움" }));

    await waitFor(() => expect(pushGrades).toHaveBeenCalledOnce());
    const [, grades] = pushGrades.mock.calls[0];
    expect(grades[0].cardId).toBe("w1:recognition");
  });

  it("recall 카드는 뜻을 먼저 보여준다", async () => {
    fetchDueWords.mockResolvedValue(dueWords([word("w1", "cat")], "recall"));

    const user = userEvent.setup();
    await startSession(user);

    // 앞면이 뜻이고, 뒤집으면 단어가 나온다.
    expect(screen.getByText("cat 뜻")).toBeInTheDocument();
    expect(screen.queryByText("cat")).not.toBeInTheDocument();
    expect(screen.getByText("눌러서 단어 보기")).toBeInTheDocument();

    await user.click(screen.getByText("cat 뜻"));
    expect(screen.getByText("cat")).toBeInTheDocument();
  });

  it("빈칸 카드는 그 자리에서 답으로 바뀐다", async () => {
    fetchDueWords.mockResolvedValue({
      cards: [
        {
          id: "n1:c1",
          kind: "c1",
          sourceType: "cloze" as const,
          wordBookId: "b1",
          cloze: {
            noteId: "n1",
            segments: [
              { text: "TCP는 ", blank: false },
              { text: "연결 지향", blank: true },
              { text: " 프로토콜이다", blank: false },
            ],
          },
          preview: { againSeconds: 60, goodSeconds: 600 },
        },
      ],
    });

    const user = userEvent.setup();
    await startSession(user);

    // 뒤집기 전에는 답이 없다.
    expect(screen.getByText("TCP는")).toBeInTheDocument();
    expect(screen.queryByText("연결 지향")).not.toBeInTheDocument();
    expect(screen.getByText("빈칸")).toBeInTheDocument();

    await user.click(screen.getByText("TCP는"));

    // 답이 문장 안에 들어간다 — 아래에 문장을 또 쓰지 않는다.
    expect(screen.getByText("연결 지향")).toBeInTheDocument();
    expect(screen.getAllByText("TCP는")).toHaveLength(1);
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

describe("시작 화면 — 단어장 선택", () => {
  it("고르지 않은 단어장의 빈칸 카드는 세지 않는다", async () => {
    // 빈칸 카드는 단어가 없어서, 예전에는 어느 단어장을 골라도 항상 포함됐다.
    fetchDueWords.mockResolvedValue({
      cards: [
        {
          id: "n9:c1",
          kind: "c1",
          sourceType: "cloze" as const,
          wordBookId: "b2",
          cloze: {
            noteId: "n9",
            segments: [{ text: "다른 단어장", blank: false }],
          },
          preview: { againSeconds: 60, goodSeconds: 600 },
        },
      ],
    });
    fetchDueCounts.mockResolvedValue({ total: 0, byBook: { b1: 0, b2: 1 } });
    window.localStorage.setItem("nyaki.review.books", JSON.stringify(["b1"]));

    const { default: ReviewPage } = await import("./page");
    render(<ReviewPage />);

    // b1만 골랐으니 b2의 빈칸 카드로는 시작할 수 없다.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /시작하기/ })).toBeDisabled(),
    );
  });

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("오늘 낼 게 없는 단어장은 기본으로 꺼져 있다", async () => {
    fetchDueCounts.mockResolvedValue({ total: 2, byBook: { b1: 2, b2: 0 } });

    const { default: ReviewPage } = await import("./page");
    render(<ReviewPage />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /냐키/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    expect(screen.getByRole("button", { name: /비어있음/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("고른 단어장을 기억한다", async () => {
    fetchDueCounts.mockResolvedValue({ total: 2, byBook: { b1: 2, b2: 1 } });

    const user = userEvent.setup();
    const { default: ReviewPage } = await import("./page");
    const view = render(<ReviewPage />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /냐키/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /냐키/ }));

    expect(window.localStorage.getItem("nyaki.review.books")).toBe(
      JSON.stringify(["b2"]),
    );

    // 다시 들어와도 그대로다.
    view.unmount();
    render(<ReviewPage />);
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /냐키/ })[0]).toHaveAttribute(
        "aria-pressed",
        "false",
      ),
    );
  });
});
