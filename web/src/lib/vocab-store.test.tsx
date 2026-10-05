import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WordBook } from "./types";

/**
 * 단어장 자리 계산.
 *
 * 폴더가 생기면서 화면 순서와 배열 순서가 갈라졌다. 평평한 배열로 이웃을 잡으면
 * 화면에서 옆에 있지도 않은 단어장 사이 값을 계산해 제자리로 돌아온다.
 * 드래그 자체(dnd-kit)는 좌표가 필요해 jsdom에서 못 돌리지만, **무엇을 저장하는지**는
 * 여기서 잡을 수 있다.
 */

const putBook = vi.fn();
const listBooks = vi.fn();
const listFolders = vi.fn();
const fetchBookSummaries = vi.fn();
// 같은 배열을 돌려준다. 테스트의 getToken은 렌더마다 새 함수라 refresh가 다시
// 도는데, 매번 새 배열이면 상태가 바뀌어 끝없이 다시 그린다.
const noImports: never[] = [];

vi.mock("./api-client", () => ({
  putBook: (...args: unknown[]) => putBook(...args),
  listBooks: (...args: unknown[]) => listBooks(...args),
  listFolders: (...args: unknown[]) => listFolders(...args),
  fetchBookSummaries: (...args: unknown[]) => fetchBookSummaries(...args),
  putFolder: vi.fn(),
  removeFolder: vi.fn(),
  putWord: vi.fn(),
  removeWord: vi.fn(),
  removeWordBook: vi.fn(),
  completeQuest: vi.fn(),
  fetchPackImports: async () => noImports,
  importPack: vi.fn(),
}));

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: { uid: "u1" }, getToken: async () => "t" }),
}));

import { useVocab, VocabProvider } from "./vocab-store";

function book(id: string, sortOrder: number, folderId?: string): WordBook {
  return {
    id,
    title: id,
    folderId,
    sortOrder,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    words: [],
  };
}

/** 스토어를 눌러보는 최소 화면. */
function Harness({ run }: { run: (store: ReturnType<typeof useVocab>) => void }) {
  const store = useVocab();
  return (
    <div>
      <button type="button" onClick={() => run(store)}>
        실행
      </button>
      <ul>
        {store.wordBooks.map((value) => (
          <li key={value.id}>{`${value.id}:${value.folderId ?? "-"}:${value.sortOrder}`}</li>
        ))}
      </ul>
    </div>
  );
}

async function mount(run: (store: ReturnType<typeof useVocab>) => void) {
  render(
    <VocabProvider>
      <Harness run={run} />
    </VocabProvider>,
  );
  await waitFor(() => expect(listBooks).toHaveBeenCalled());
  await act(async () => {});
  await userEvent.click(screen.getByRole("button", { name: "실행" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  listFolders.mockResolvedValue([
    { id: "f1", title: "f1", createdAt: "x", updatedAt: "x" },
  ]);
  fetchBookSummaries.mockResolvedValue({});
  putBook.mockImplementation(async (_t, id) => book(id, 1));
});

describe("reorderWordBooks — 같은 폴더 안에서만 자리를 잰다", () => {
  it("폴더 안 형제들 사이 값으로 계산한다", async () => {
    // 배열은 [폴더 안 a, 폴더 밖 x, 폴더 안 b, 폴더 안 c] 처럼 섞여 있다.
    listBooks.mockResolvedValue([
      book("a", 1, "f1"),
      book("x", 2),
      book("b", 3, "f1"),
      book("c", 4, "f1"),
    ]);

    await mount((store) => void store.reorderWordBooks("a", "b"));

    await waitFor(() => expect(putBook).toHaveBeenCalled());
    // a를 b 자리로 → b(3)와 c(4) 사이인 3.5. 폴더 밖 x(2)는 끼어들지 않는다.
    expect(putBook.mock.calls[0]![2]).toMatchObject({ sortOrder: 3.5 });
  });

  it("폴더가 다르면 아무것도 저장하지 않는다 — 옮기기는 다른 일이다", async () => {
    listBooks.mockResolvedValue([book("a", 1, "f1"), book("x", 2)]);

    await mount((store) => void store.reorderWordBooks("a", "x"));

    await act(async () => {});
    expect(putBook).not.toHaveBeenCalled();
  });
});

describe("moveWordBook — 옮긴 폴더의 맨 뒤로", () => {
  it("새 자리를 함께 저장한다", async () => {
    listBooks.mockResolvedValue([
      book("a", 1, "f1"),
      book("b", 2, "f1"),
      book("x", 5),
    ]);

    await mount((store) => void store.moveWordBook("x", "f1"));

    await waitFor(() => expect(putBook).toHaveBeenCalled());
    // f1의 마지막이 2이므로 3을 받는다. 자리를 안 주면 5가 남아 엉뚱한 데 낀다.
    expect(putBook.mock.calls[0]![2]).toMatchObject({
      folderId: "f1",
      sortOrder: 3,
    });
  });

  it("폴더 밖으로 꺼낼 때는 null을 보낸다", async () => {
    listBooks.mockResolvedValue([book("a", 1, "f1"), book("x", 5)]);

    await mount((store) => void store.moveWordBook("a", null));

    await waitFor(() => expect(putBook).toHaveBeenCalled());
    expect(putBook.mock.calls[0]![2]).toMatchObject({ folderId: null });
  });
});
