import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Folder, WordBook } from "@/lib/types";

/**
 * 사이드바 — 폴더와 단어장.
 *
 * 드래그 자체(dnd-kit)는 여기서 검증하지 않는다. 포인터 좌표를 흉내 내는
 * 테스트는 깨지기 쉽고, 정작 틀리기 쉬운 것은 **무엇을 어디에 그리는지**와
 * **폴더를 지울 때 무엇이 함께 지워진다고 알려주는지**다.
 */

const renameFolder = vi.fn();
const deleteFolder = vi.fn();

let folders: Folder[] = [];
let wordBooks: WordBook[] = [];

vi.mock("next/navigation", () => ({
  usePathname: () => "/word-books",
}));

vi.mock("@/lib/vocab-store", () => ({
  useVocab: () => ({
    wordBooks,
    folders,
    summaries: {},
    loading: false,
    reorderWordBooks: vi.fn(),
    reorderFolders: vi.fn(),
    moveWordBook: vi.fn(),
    renameFolder,
    deleteFolder,
  }),
}));

import { AppShell } from "./app-shell";

function book(id: string, folderId?: string): WordBook {
  return {
    id,
    title: id,
    folderId,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    words: [],
  };
}

function folder(id: string, title = id): Folder {
  return {
    id,
    title,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  folders = [folder("f1", "시험")];
  wordBooks = [book("inside", "f1"), book("loose")];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("사이드바", () => {
  it("폴더 안 단어장과 폴더 밖 단어장을 모두 그린다", () => {
    render(<AppShell>본문</AppShell>);

    expect(screen.getByText("시험")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /inside/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /loose/ })).toBeInTheDocument();
  });

  it("폴더를 접으면 안의 단어장이 사라진다", async () => {
    render(<AppShell>본문</AppShell>);

    await userEvent.click(screen.getByRole("button", { expanded: true }));

    expect(screen.queryByRole("link", { name: /inside/ })).not.toBeInTheDocument();
    // 폴더 밖은 그대로다.
    expect(screen.getByRole("link", { name: /loose/ })).toBeInTheDocument();
  });

  it("폴더를 지울 때 안의 단어장이 함께 지워진다고 알려준다", async () => {
    const confirm = vi.fn().mockReturnValue(true);
    vi.stubGlobal("confirm", confirm);

    render(<AppShell>본문</AppShell>);
    await userEvent.click(screen.getByRole("button", { name: "시험 삭제" }));

    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining("단어장 1개와 그 단어가 함께 삭제됩니다"),
    );
    expect(deleteFolder).toHaveBeenCalledWith("f1");
  });

  it("취소하면 지우지 않는다", async () => {
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));

    render(<AppShell>본문</AppShell>);
    await userEvent.click(screen.getByRole("button", { name: "시험 삭제" }));

    expect(deleteFolder).not.toHaveBeenCalled();
  });

  it("빈 폴더는 경고에 개수를 적지 않는다", async () => {
    wordBooks = [book("loose")];
    const confirm = vi.fn().mockReturnValue(true);
    vi.stubGlobal("confirm", confirm);

    render(<AppShell>본문</AppShell>);
    await userEvent.click(screen.getByRole("button", { name: "시험 삭제" }));

    expect(confirm).toHaveBeenCalledWith(
      expect.not.stringContaining("함께 삭제됩니다"),
    );
  });

});
