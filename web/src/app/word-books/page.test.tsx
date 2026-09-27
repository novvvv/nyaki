import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * 단어장 화면의 헤더 버튼.
 *
 * 폴더 만들기는 원래 사이드바 구석의 `+`였는데 글자 하나짜리라 눈에 안 띄었다.
 * "새 단어장" 옆으로 옮기고, 단어장과 같은 별도 화면으로 보낸다.
 */

vi.mock("@/lib/vocab-store", () => ({
  useVocab: () => ({
    wordBooks: [],
    summaries: {},
    loading: false,
    error: null,
  }),
}));

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
});
