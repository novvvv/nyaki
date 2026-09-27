import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** 폴더 만들기 화면. 단어장 만들기와 같은 모양이다. */

const createFolder = vi.fn();
const push = vi.fn();
const back = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back }),
}));

vi.mock("@/lib/vocab-store", () => ({
  useVocab: () => ({ createFolder }),
}));

import NewFolderPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  createFolder.mockResolvedValue({ id: "f1" });
});

describe("폴더 만들기", () => {
  it("이름을 적고 만들면 앞뒤 공백을 떼고 목록으로 돌아간다", async () => {
    render(<NewFolderPage />);

    await userEvent.type(screen.getByRole("textbox"), "  정보처리기사  ");
    await userEvent.click(screen.getByRole("button", { name: "만들기" }));

    expect(createFolder).toHaveBeenCalledWith("정보처리기사");
    expect(push).toHaveBeenCalledWith("/word-books");
  });

  it("이름이 비면 만들지 않고 이유를 알려준다", async () => {
    render(<NewFolderPage />);

    await userEvent.click(screen.getByRole("button", { name: "만들기" }));

    expect(createFolder).not.toHaveBeenCalled();
    expect(screen.getByText("폴더 이름을 입력해 주세요")).toBeInTheDocument();
  });

  it("실패하면 화면에 머문다 — 적은 이름을 잃지 않는다", async () => {
    createFolder.mockRejectedValue(new Error("서버가 응답하지 않아요."));
    const alert = vi.fn();
    vi.stubGlobal("alert", alert);

    render(<NewFolderPage />);
    await userEvent.type(screen.getByRole("textbox"), "시험");
    await userEvent.click(screen.getByRole("button", { name: "만들기" }));

    expect(alert).toHaveBeenCalledWith("서버가 응답하지 않아요.");
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("시험");

    vi.unstubAllGlobals();
  });
});
