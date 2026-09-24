import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClozeNote, WordBook } from "@/lib/types";

/**
 * 단어장 상세.
 *
 * 여기서 지키는 것은 **빈칸 노트가 단어 유무와 무관하게 보이는 것**이다.
 * 빈칸 노트 목록을 "단어가 있을 때"만 그리는 자리에 넣어서, 빈칸 노트만 만든
 * 단어장이 빈 화면으로 보인 적이 있다.
 */

const fetchClozeNotes = vi.fn();
const removeClozeNote = vi.fn();
const deleteWord = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/api-client", () => ({
  fetchClozeNotes: (...args: unknown[]) => fetchClozeNotes(...args),
  removeClozeNote: (...args: unknown[]) => removeClozeNote(...args),
}));

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ getToken: async () => "test-token" }),
}));

const book: WordBook = {
  id: "b1",
  title: "냐키",
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  words: [],
};

const summaries: Record<string, unknown> = {
  b1: { wordBookId: "b1", itemCount: 1, cardCount: 1, masteryRate: 20 },
};

vi.mock("@/lib/vocab-store", () => ({
  useVocab: () => ({
    getWordBook: () => book,
    summaries,
    deleteWord: (...args: unknown[]) => deleteWord(...args),
    deleteWordBook: vi.fn(),
    updateWordBook: vi.fn(),
    refresh: (...args: unknown[]) => refresh(...args),
  }),
  activeWords: (value: WordBook) => value.words.filter((w) => !w.isDeleted),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "b1" }),
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const note: ClozeNote = {
  id: "n1",
  wordBookId: "b1",
  text: "TCP는 {{c1::연결 지향}} 프로토콜이다",
  createdAt: "2026-09-24T00:00:00Z",
  updatedAt: "2026-09-24T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchClozeNotes.mockResolvedValue([note]);
});

describe("단어장 상세", () => {
  it("단어가 없어도 빈칸 노트가 목록에 뜬다", async () => {
    const { default: Page } = await import("./page");
    render(<Page />);

    // 목록에는 답을 괄호로 감싸 보여준다 — 원문 문법을 그대로 노출하지 않는다.
    await waitFor(() =>
      expect(
        screen.getByText("TCP는 [ 연결 지향 ] 프로토콜이다"),
      ).toBeInTheDocument(),
    );
    // 줄을 누르면 수정 화면으로 간다 — 단어와 같다.
    expect(
      screen.getByRole("link", { name: /TCP는 \[ 연결 지향 \]/ }),
    ).toHaveAttribute("href", "/word-books/b1/cloze-notes/n1");
  });

  it("개수와 암기율은 서버가 센 값을 쓴다", async () => {
    const { default: Page } = await import("./page");
    render(<Page />);

    // 빈칸 노트도 항목으로 세고, 암기율도 카드 기준이다.
    await waitFor(() =>
      expect(screen.getByText(/1개 · 카드 1장 · 암기 20%/)).toBeInTheDocument(),
    );
  });

  it("단어도 노트도 없으면 빈 상태", async () => {
    fetchClozeNotes.mockResolvedValue([]);

    const { default: Page } = await import("./page");
    render(<Page />);

    await waitFor(() =>
      expect(screen.getByText("아직 비어 있습니다")).toBeInTheDocument(),
    );
  });
});

describe("삭제", () => {
  it("목록에서 빈칸 노트를 지운다", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    removeClozeNote.mockResolvedValue(undefined);

    const { default: Page } = await import("./page");
    render(<Page />);

    const button = await screen.findByRole("button", {
      name: "TCP는 [ 연결 지향 ] 프로토콜이다 삭제",
    });
    await user.click(button);

    await waitFor(() =>
      expect(removeClozeNote).toHaveBeenCalledWith(
        "test-token",
        "b1",
        "n1",
      ),
    );
    // 개수·암기율은 서버가 세므로 지운 뒤 다시 받아야 한다.
    expect(refresh).toHaveBeenCalled();
  });

  it("확인을 취소하면 아무 일도 없다", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);

    const { default: Page } = await import("./page");
    render(<Page />);

    await user.click(
      await screen.findByRole("button", {
        name: "TCP는 [ 연결 지향 ] 프로토콜이다 삭제",
      }),
    );

    expect(removeClozeNote).not.toHaveBeenCalled();
  });
});
