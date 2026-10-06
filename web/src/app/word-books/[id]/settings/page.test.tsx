import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 단어장 설정의 폴더 고르기.
 *
 * 좁은 화면에는 끌어서 옮길 사이드바가 없어서 여기서 폴더를 고른다.
 * 이동(moveWordBook)은 화면이 들고 있던 이름 · 설명을 같이 보내므로, 이름 저장
 * 뒤에 부르면 방금 바꾼 이름이 되돌아간다. 그래서 순서를 지킨다.
 */

const calls: string[] = [];
const moveWordBook = vi.fn(async (...args: unknown[]) => {
  void args;
  calls.push("move");
});
const updateWordBook = vi.fn(async (...args: unknown[]) => {
  void args;
  calls.push("update");
});
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "b1" }),
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/vocab-store", () => ({
  useVocab: () => ({
    getWordBook: () => ({
      id: "b1",
      title: "기출 2020",
      description: "",
      folderId: undefined,
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
      words: [],
    }),
    updateWordBook,
    moveWordBook,
    folders: [
      { id: "f1", title: "정보처리기사", createdAt: "x", updatedAt: "x" },
    ],
  }),
}));

import WordBookSettingsPage from "./page";

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
});

describe("단어장 설정 — 폴더", () => {
  it("폴더를 고르고 이름도 바꾸면, 옮긴 뒤에 이름을 저장한다", async () => {
    const user = userEvent.setup();
    render(<WordBookSettingsPage />);

    const name = screen.getByRole("textbox", { name: "이름" });
    await user.clear(name);
    await user.type(name, "기출 2020 정리");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "폴더" }),
      "f1",
    );
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(calls).toEqual(["move", "update"]);
    expect(moveWordBook).toHaveBeenCalledWith("b1", "f1");
    expect(updateWordBook).toHaveBeenCalledWith("b1", {
      title: "기출 2020 정리",
      description: undefined,
    });
  });

  it("폴더를 그대로 두면 옮기지 않는다", async () => {
    const user = userEvent.setup();
    render(<WordBookSettingsPage />);

    await user.type(screen.getByRole("textbox", { name: "이름" }), "!");
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(moveWordBook).not.toHaveBeenCalled();
    expect(updateWordBook).toHaveBeenCalled();
  });

  it("폴더만 바꿔도 저장할 수 있다", async () => {
    const user = userEvent.setup();
    render(<WordBookSettingsPage />);

    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "폴더" }),
      "f1",
    );

    expect(screen.getByRole("button", { name: "저장" })).toBeEnabled();
  });
});
