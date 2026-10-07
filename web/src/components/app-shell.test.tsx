import { fireEvent, render, screen } from "@testing-library/react";
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

let pathname = "/word-books";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
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

import {
  AppShell,
  SIDEBAR_DEFAULT,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  clampSidebarWidth,
} from "./app-shell";

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
  pathname = "/word-books";
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

describe("사이드바 폭", () => {
  const KEY = "nyaki.sidebarWidth";

  beforeEach(() => {
    window.localStorage.clear();
  });

  function sidebar() {
    return screen.getByRole("separator", { name: "사이드바 폭 조절" })
      .parentElement!;
  }

  it("범위 밖이나 이상한 값은 최소 · 최대 · 기본으로 묶는다", () => {
    expect(clampSidebarWidth(50)).toBe(SIDEBAR_MIN);
    expect(clampSidebarWidth(9999)).toBe(SIDEBAR_MAX);
    expect(clampSidebarWidth(Number.NaN)).toBe(SIDEBAR_DEFAULT);
    expect(clampSidebarWidth(251.6)).toBe(252);
  });

  it("처음에는 기본 폭, 저장된 폭이 있으면 그 폭으로 연다", () => {
    const { unmount } = render(<AppShell>본문</AppShell>);
    expect(sidebar()).toHaveStyle({ width: `${SIDEBAR_DEFAULT}px` });
    unmount();

    window.localStorage.setItem(KEY, "320");
    render(<AppShell>본문</AppShell>);
    expect(sidebar()).toHaveStyle({ width: "320px" });
  });

  it("경계선을 끌면 폭이 바뀌고, 손을 떼면 기억한다", () => {
    render(<AppShell>본문</AppShell>);
    const handle = screen.getByRole("separator", { name: "사이드바 폭 조절" });

    fireEvent.pointerDown(handle, { clientX: 240, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 300, pointerId: 1 });
    expect(sidebar()).toHaveStyle({ width: "300px" });

    // 최대를 넘겨 끌어도 최대에서 멈춘다.
    fireEvent.pointerMove(handle, { clientX: 2000, pointerId: 1 });
    expect(sidebar()).toHaveStyle({ width: `${SIDEBAR_MAX}px` });

    fireEvent.pointerUp(handle, { clientX: 2000, pointerId: 1 });
    expect(window.localStorage.getItem(KEY)).toBe(String(SIDEBAR_MAX));

    // 손을 뗀 뒤 움직임은 무시한다.
    fireEvent.pointerMove(handle, { clientX: 100, pointerId: 1 });
    expect(sidebar()).toHaveStyle({ width: `${SIDEBAR_MAX}px` });
  });

  it("두 번 누르면 기본 폭으로 돌아간다", () => {
    window.localStorage.setItem(KEY, "380");
    render(<AppShell>본문</AppShell>);

    fireEvent.doubleClick(
      screen.getByRole("separator", { name: "사이드바 폭 조절" }),
    );

    expect(sidebar()).toHaveStyle({ width: `${SIDEBAR_DEFAULT}px` });
    expect(window.localStorage.getItem(KEY)).toBe(String(SIDEBAR_DEFAULT));
  });
});

describe("사이드바 아이콘", () => {
  function iconIn(element: HTMLElement): string {
    return element.querySelector("img")!.getAttribute("src")!;
  }

  it("펼친 폴더는 채운 아이콘, 접으면 빈 아이콘", async () => {
    const user = userEvent.setup();
    render(<AppShell>본문</AppShell>);
    const toggle = screen.getByRole("button", { name: "시험" });

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(iconIn(toggle)).toBe("/sidebar/folder_clicked.png");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(iconIn(toggle)).toBe("/sidebar/folder_unclicked.png");
  });

  it("지금 보고 있는 단어장만 채운 아이콘", () => {
    pathname = "/word-books/loose";
    render(<AppShell>본문</AppShell>);

    expect(iconIn(screen.getByRole("link", { name: /loose/ }))).toBe(
      "/sidebar/doc_clicked.png",
    );
    expect(iconIn(screen.getByRole("link", { name: /inside/ }))).toBe(
      "/sidebar/doc_unclicked.png",
    );
  });

  it("아이콘은 장식이라 읽어주지 않는다", () => {
    render(<AppShell>본문</AppShell>);

    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });
});
