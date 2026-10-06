import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 단어장 화면의 헤더 버튼.
 *
 * 폴더 만들기는 원래 사이드바 구석의 `+`였는데 글자 하나짜리라 눈에 안 띄었다.
 * "새 단어장" 옆으로 옮기고, 단어장과 같은 별도 화면으로 보낸다.
 */

const store = {
  wordBooks: [] as unknown[],
  folders: [] as unknown[],
  summaries: {} as Record<string, unknown>,
  loading: false,
  error: null,
};

vi.mock("@/lib/vocab-store", () => ({
  useVocab: () => store,
}));

function book(id: string, folderId?: string) {
  return {
    id,
    title: id,
    folderId,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    words: [],
  };
}

beforeEach(() => {
  store.wordBooks = [];
  store.folders = [];
  store.summaries = {};
});

import WordBooksPage from "./page";

describe("단어장 화면", () => {
  it("헤더에 새 폴더와 새 단어장이 나란히 있다", () => {
    render(<WordBooksPage />);

    expect(screen.getByRole("link", { name: "새 폴더" })).toHaveAttribute(
      "href",
      "/word-books/folders/new",
    );
    expect(
      screen.getAllByRole("link", { name: "새 단어장" }).length,
    ).toBeGreaterThan(0);
  });

  it("좁은 화면 목록은 폴더 아래에 단어장을 묶고, 폴더 밖은 뒤에 둔다", async () => {
    const user = userEvent.setup();
    store.folders = [
      { id: "f1", title: "정보처리기사", createdAt: "x", updatedAt: "x" },
    ];
    store.wordBooks = [
      book("기출 2020", "f1"),
      book("SQL"),
      book("기출 2021", "f1"),
    ];
    store.summaries = { "기출 2020": { itemCount: 27 } };

    render(<WordBooksPage />);

    const folder = screen.getByRole("button", { name: /정보처리기사/ });
    expect(folder).toHaveAttribute("aria-expanded", "true");
    expect(folder.textContent).toContain("단어장 2개");
    const inside = within(folder.closest("li")!).getAllByRole("link");
    expect(inside.map((link) => link.textContent)).toEqual([
      "기출 202027개",
      "기출 20210개",
    ]);
    // 폴더 밖 단어장은 폴더 다음에 온다.
    const links = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(links.indexOf("/word-books/SQL")).toBeGreaterThan(
      links.indexOf("/word-books/기출 2021"),
    );

    // 접으면 안의 단어장이 사라진다.
    await user.click(folder);
    expect(folder).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: /기출 2020/ })).toBeNull();
    expect(screen.getByRole("link", { name: /SQL/ })).toBeInTheDocument();
  });

  it("폴더를 못 찾는 단어장은 숨기지 않고 밖에 보인다", () => {
    store.wordBooks = [book("고아", "지워진폴더")];

    render(<WordBooksPage />);

    expect(screen.getByRole("link", { name: /고아/ })).toBeInTheDocument();
  });
});
