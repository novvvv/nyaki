"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/components/auth-provider";


import {
  completeQuest,
  fetchBookSummaries,
  fetchPackImports,
  importPack as postPackImport,
  listBooks,
  listFolders,
  putFolder,
  removeFolder,
  putBook,
  putWord,
  removeWord,
  removeWordBook,
} from "./api-client";

import type { BookSummary, PackImport } from "./api-client";
import type { Folder } from "./types";
import { reorder } from "./sort-order";
import type { Word, WordBook, WordBookInput, WordInput } from "./types";
import { newId } from "./utils";

interface VocabContextValue {
  wordBooks: WordBook[];
  /** 단어장을 담는 폴더. 한 단계뿐이고, 폴더 밖 단어장도 있다. */
  folders: Folder[];
  createFolder: (title: string) => Promise<Folder>;
  renameFolder: (id: string, title: string) => Promise<void>;
  /** 폴더와 **그 안의 단어장까지** 지운다. 화면이 미리 알려준 뒤에 부른다. */
  deleteFolder: (id: string) => Promise<void>;
  reorderFolders: (activeId: string, overId: string) => Promise<void>;
  /** 단어장을 폴더에 넣거나(id) 폴더 밖으로 꺼낸다(null). */
  moveWordBook: (bookId: string, folderId: string | null) => Promise<void>;
  /**
   * 단어장별 집계(항목 수·카드 수·암기율). **서버가 센 값이다.**
   *
   * 화면마다 각자 세다가 숫자가 갈렸다 — 목록은 단어만 세어 빈칸 노트가 빠졌고,
   * 암기율은 단어의 srs_*만 읽어 빈칸 카드를 무시했다.
   */
  summaries: Record<string, BookSummary>;
  /**
   * 집계를 임시로 보정한다. 서버 응답을 기다리는 동안 지운 항목이 계속 세어져
   * 보이는 것을 막는 용도다 — 곧바로 refresh()로 실제 값이 덮어쓴다.
   */
  patchSummary: (bookId: string, itemDelta: number) => void;
  /** 항목이 바뀐 뒤 집계를 다시 받는다. */
  syncSummaries: () => Promise<void>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getWordBook: (id: string) => WordBook | undefined;
  createWordBook: (input: WordBookInput) => Promise<WordBook>;
  updateWordBook: (id: string, input: WordBookInput) => Promise<WordBook>;
  /**
   * 단어장 순서를 바꾼다 — [activeId]를 [overId] 자리로.
   *
   * 자리 계산은 **같은 폴더 안 형제들** 사이에서 한다. 평평한 배열로 계산하면
   * 화면에서 옆에 있지도 않은 단어장 사이 값을 잡아 제자리로 돌아온다.
   */
  reorderWordBooks: (activeId: string, overId: string) => Promise<void>;
  createWord: (wordBookId: string, input: WordInput) => Promise<Word>;
  updateWord: (
    wordBookId: string,
    wordId: string,
    input: WordInput,
  ) => Promise<Word | undefined>;
  deleteWord: (wordBookId: string, wordId: string) => Promise<void>;
  deleteWordBook: (wordBookId: string) => Promise<void>;
  /** 내가 담은 단어 묶음. 담은 단어장이 지워진 것은 빠져 있다. */
  packImports: PackImport[];
  /**
   * 단어 묶음을 단어장에 담고, 담은 단어장 id를 돌려준다.
   *
   * importId는 화면이 한 번 만들어 두고 재시도할 때 그대로 넘긴다 — 응답이
   * 끊겨 다시 눌러도 서버가 같은 요청으로 알아보고 두 번 넣지 않는다.
   */
  importPack: (input: ImportPackInput) => Promise<string>;
}

export interface ImportPackInput {
  importId: string;
  packId: string;
  words: { term: string; reading?: string; meaning: string }[];
  target:
    | { type: "existing"; wordBookId: string }
    | { type: "new"; title: string; folderId: string | null };
}

const VocabContext = createContext<VocabContextValue | null>(null);

export function VocabProvider({ children }: { children: ReactNode }) {
  const { user, getToken } = useAuth();
  const [wordBooks, setWordBooks] = useState<WordBook[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [summaries, setSummaries] = useState<Record<string, BookSummary>>({});
  const [packImports, setPackImports] = useState<PackImport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setWordBooks([]);
      setFolders([]);
      return;
    }
    setLoading(true);
    try {
      const [books, bookSummaries, folderRows, imports] = await Promise.all([
        listBooks(token),
        fetchBookSummaries(token),
        listFolders(token),
        // 담은 기록은 "이미 담았어요" 표시에만 쓴다. 못 받아도 목록은 떠야 한다
        // — 서버가 아직 이 API를 모르는 배포 순간에도 앱이 멈추지 않게.
        fetchPackImports(token).catch(() => []),
      ]);
      setWordBooks(books);
      setSummaries(bookSummaries);
      setFolders(folderRows);
      setPackImports(imports);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "목록을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    // 이펙트 본문에서 곧바로 setState가 일어나지 않도록 async 블록으로 감싼다
    // (react-hooks/set-state-in-effect). 첫 목록을 받아오는 것뿐이라 동작은 같다.
    void (async () => {
      await refresh();
    })();
  }, [refresh, user?.uid]);

  const getWordBook = useCallback(
    (id: string) => wordBooks.find((book) => book.id === id),
    [wordBooks],
  );

  const createWordBook = useCallback(async (input: WordBookInput) => {
    const token = await getToken();
    if (!token) throw new Error("로그인이 필요합니다.");
    const created: WordBook = {
      ...(await putBook(token, newId("book"), input)),
      words: [],
    };
    // 서버가 맨 뒤 자리를 주므로 화면도 맨 뒤에 붙인다. 앞에 넣으면 새로고침할
    // 때 아래로 내려가 위치가 튄다.
    setWordBooks((prev) => [...prev, created]);
    return created;
  }, [getToken]);

  /**
   * 집계만 다시 받는다.
   *
   * 단어를 추가·삭제해도 개수가 그대로였다 — 목록은 스토어의 집계를 읽는데
   * 그 값은 처음 한 번만 받아왔기 때문이다. 항목이 바뀌는 곳마다 부른다.
   */
  const syncSummaries = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      setSummaries(await fetchBookSummaries(token));
    } catch {
      // 숫자가 잠깐 낡는 것보다 화면이 멈추는 게 나쁘다.
    }
  }, [getToken]);

  const patchSummary = useCallback((bookId: string, itemDelta: number) => {
    setSummaries((prev) => {
      const current = prev[bookId];
      if (!current) return prev;
      return {
        ...prev,
        [bookId]: {
          ...current,
          itemCount: Math.max(0, current.itemCount + itemDelta),
        },
      };
    });
  }, []);

  const updateWordBook = useCallback(
    async (id: string, input: WordBookInput) => {
      const token = await getToken();
      if (!token) throw new Error("로그인이 필요합니다.");

      const current = wordBooks.find((book) => book.id === id);
      const saved = await putBook(token, id, input, current?.createdAt);
      // 단어 목록은 서버 응답에 없다 — 갖고 있던 것을 유지한다.
      const next: WordBook = { ...saved, words: current?.words ?? [] };
      setWordBooks((prev) =>
        prev.map((book) => (book.id === id ? next : book)),
      );
      return next;
    },
    [getToken, wordBooks],
  );

  /** sortOrder 순으로 정렬. 폴더 구분은 화면이 하고, 배열은 한 줄로 둔다. */
  const sortedBooks = useCallback(
    (books: WordBook[]) =>
      [...books].sort(
        (a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity),
      ),
    [],
  );

  const reorderWordBooks = useCallback(
    async (activeId: string, overId: string) => {
      const active = wordBooks.find((book) => book.id === activeId);
      if (!active) return;

      // 같은 폴더 안에서만 자리를 잰다.
      const siblings = wordBooks.filter(
        (book) => (book.folderId ?? null) === (active.folderId ?? null),
      );
      const from = siblings.findIndex((book) => book.id === activeId);
      const to = siblings.findIndex((book) => book.id === overId);
      if (from < 0 || to < 0) return;

      const { changed } = reorder(siblings, from, to);
      if (changed.length === 0) return;

      const orders = new Map(changed.map((row) => [row.id, row.sortOrder]));
      const next = sortedBooks(
        wordBooks.map((book) =>
          orders.has(book.id)
            ? { ...book, sortOrder: orders.get(book.id)! }
            : book,
        ),
      );

      // 먼저 화면부터 옮긴다. 저장을 기다리면 손을 뗀 카드가 제자리로
      // 돌아갔다가 다시 움직이는 것처럼 보인다.
      setWordBooks(next);

      const token = await getToken();
      if (!token) return;

      try {
        await Promise.all(
          changed.map((row) => {
            const book = next.find((value) => value.id === row.id)!;
            return putBook(
              token,
              book.id,
              {
                title: book.title,
                description: book.description,
                sortOrder: row.sortOrder,
              },
              book.createdAt,
            );
          }),
        );
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "순서를 저장하지 못했어요.",
        );
        // 서버가 진짜 무엇을 갖고 있는지로 되돌린다.
        await refresh();
      }
    },
    [getToken, refresh, sortedBooks, wordBooks],
  );

  const createFolder = useCallback(
    async (title: string) => {
      const token = await getToken();
      if (!token) throw new Error("로그인이 필요합니다.");
      const created = await putFolder(token, newId("folder"), title);
      setFolders((prev) => [...prev, created]);
      return created;
    },
    [getToken],
  );

  const renameFolder = useCallback(
    async (id: string, title: string) => {
      const token = await getToken();
      if (!token) throw new Error("로그인이 필요합니다.");
      const current = folders.find((folder) => folder.id === id);
      const saved = await putFolder(token, id, title, {
        sortOrder: current?.sortOrder,
        createdAt: current?.createdAt,
      });
      setFolders((prev) => prev.map((folder) => (folder.id === id ? saved : folder)));
    },
    [folders, getToken],
  );

  const deleteFolder = useCallback(
    async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error("로그인이 필요합니다.");
      await removeFolder(token, id);
      setFolders((prev) => prev.filter((folder) => folder.id !== id));
      // 안의 단어장도 함께 지워졌다. 서버가 가진 것으로 맞춘다.
      await refresh();
    },
    [getToken, refresh],
  );

  const reorderFolders = useCallback(
    async (activeId: string, overId: string) => {
      const from = folders.findIndex((folder) => folder.id === activeId);
      const to = folders.findIndex((folder) => folder.id === overId);
      if (from < 0 || to < 0) return;

      const { items, changed } = reorder(folders, from, to);
      if (changed.length === 0) return;

      setFolders(items);

      const token = await getToken();
      if (!token) return;
      try {
        await Promise.all(
          changed.map((row) => {
            const folder = items.find((value) => value.id === row.id)!;
            return putFolder(token, folder.id, folder.title, {
              sortOrder: row.sortOrder,
              createdAt: folder.createdAt,
            });
          }),
        );
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "순서를 저장하지 못했어요.",
        );
        await refresh();
      }
    },
    [folders, getToken, refresh],
  );

  const moveWordBook = useCallback(
    async (bookId: string, folderId: string | null) => {
      const token = await getToken();
      if (!token) throw new Error("로그인이 필요합니다.");
      const current = wordBooks.find((book) => book.id === bookId);
      if (!current) return;

      // 옮긴 자리의 맨 뒤에 붙인다. 자리를 안 주면 예전 값이 그대로 남아
      // 새 폴더 한가운데 끼어든다.
      const tail = wordBooks
        .filter(
          (book) => book.id !== bookId && (book.folderId ?? null) === folderId,
        )
        .reduce((max, book) => Math.max(max, book.sortOrder ?? 0), 0);
      const sortOrder = tail + 1;

      setWordBooks((prev) =>
        sortedBooks(
          prev.map((book) =>
            book.id === bookId
              ? { ...book, folderId: folderId ?? undefined, sortOrder }
              : book,
          ),
        ),
      );

      try {
        await putBook(
          token,
          bookId,
          {
            title: current.title,
            description: current.description,
            folderId,
            sortOrder,
          },
          current.createdAt,
        );
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "옮기지 못했어요.",
        );
        await refresh();
      }
    },
    [getToken, refresh, sortedBooks, wordBooks],
  );

  const createWord = useCallback(async (wordBookId: string, input: WordInput) => {
    const token = await getToken();
    if (!token) throw new Error("로그인이 필요합니다.");
    const created = await putWord(token, wordBookId, newId("word"), input);

    setWordBooks((prev) =>
      prev.map((book) =>
        book.id === wordBookId
          ? { ...book, words: [...book.words, created], updatedAt: created.updatedAt }
          : book,
      ),
    );

    // 퀘스트 완료 신고는 best-effort — 실패해도 단어 생성 자체는 이미
    // 끝난 뒤라 사용자에게 영향 없음(오늘 이미 완료했으면 서버가 idempotent
    // 처리하니 매번 호출해도 안전).
    void completeQuest(token, "add_word").catch(() => {});

    // 항목 수·암기율은 서버가 센다 — 추가한 뒤 다시 받아야 목록 숫자가 맞는다.
    await syncSummaries();

    return created;
  }, [getToken, syncSummaries]);

  const updateWord = useCallback(
    async (wordBookId: string, wordId: string, input: WordInput) => {
      const token = await getToken();
      const current = wordBooks
        .find((book) => book.id === wordBookId)
        ?.words.find((word) => word.id === wordId);
      if (!token || !current) return undefined;
      const updated = await putWord(
        token,
        wordBookId,
        wordId,
        {
          ...input,
          memorizationStatus:
            input.memorizationStatus ?? current.memorizationStatus,
          isBookmarked: input.isBookmarked ?? current.isBookmarked,
          tags: input.tags ?? current.tags,
        },
        current.createdAt,
      );

      setWordBooks((prev) =>
        prev.map((book) => {
          if (book.id !== wordBookId) return book;
          return {
            ...book,
            updatedAt: updated.updatedAt,
            words: book.words.map((word) => {
              if (word.id !== wordId || word.isDeleted) return word;
              return updated;
            }),
          };
        }),
      );
      await syncSummaries();
      return updated;
    },
    [getToken, syncSummaries, wordBooks],
  );

  const deleteWord = useCallback(async (wordBookId: string, wordId: string) => {
    const token = await getToken();
    if (!token) throw new Error("로그인이 필요합니다.");
    await removeWord(token, wordBookId, wordId);
    const now = new Date().toISOString();
    setWordBooks((prev) =>
      prev.map((book) => {
        if (book.id !== wordBookId) return book;
        return {
          ...book,
          updatedAt: now,
          words: book.words.map((word) =>
            word.id === wordId
              ? { ...word, isDeleted: true, updatedAt: now }
              : word,
          ),
        };
      }),
    );
    await syncSummaries();
  }, [getToken, syncSummaries]);

  const deleteWordBook = useCallback(async (wordBookId: string) => {
    const token = await getToken();
    if (!token) throw new Error("로그인이 필요합니다.");
    await removeWordBook(token, wordBookId);
    setWordBooks((prev) => prev.filter((book) => book.id !== wordBookId));
  }, [getToken]);

  const importPack = useCallback(
    async ({ importId, packId, words, target }: ImportPackInput) => {
      const token = await getToken();
      if (!token) throw new Error("로그인이 필요합니다.");

      const record = await postPackImport(token, {
        id: importId,
        packId,
        wordBookId:
          target.type === "existing" ? target.wordBookId : newId("book"),
        newBook:
          target.type === "new"
            ? { title: target.title, folderId: target.folderId }
            : undefined,
        words: words.map((word) => ({
          id: newId("word"),
          term: word.term,
          pronunciation: word.reading,
          meaning: word.meaning,
        })),
      });
      // 단어장 · 단어 · 집계 · 담은 기록이 한꺼번에 바뀌었다. 사이드바와
      // "이미 담았어요" 표시가 바로 맞도록 전부 다시 받는다.
      await refresh();
      // 재전송이면 서버가 처음 기록을 돌려주므로 그 단어장으로 간다.
      return record.wordBookId;
    },
    [getToken, refresh],
  );

  const value = useMemo(
    () => ({
      wordBooks,
      folders,
      createFolder,
      renameFolder,
      deleteFolder,
      reorderFolders,
      moveWordBook,
      summaries,
      patchSummary,
      syncSummaries,
      loading,
      error,
      refresh,
      getWordBook,
      createWordBook,
      updateWordBook,
      reorderWordBooks,
      createWord,
      updateWord,
      deleteWord,
      deleteWordBook,
      packImports,
      importPack,
    }),
    [
      wordBooks,
      folders,
      createFolder,
      renameFolder,
      deleteFolder,
      reorderFolders,
      moveWordBook,
      summaries,
      patchSummary,
      syncSummaries,
      loading,
      error,
      refresh,
      getWordBook,
      createWordBook,
      updateWordBook,
      reorderWordBooks,
      createWord,
      updateWord,
      deleteWord,
      deleteWordBook,
      packImports,
      importPack,
    ],
  );

  return (
    <VocabContext.Provider value={value}>{children}</VocabContext.Provider>
  );
}

export function useVocab() {
  const ctx = useContext(VocabContext);
  if (!ctx) {
    throw new Error("useVocab must be used within VocabProvider");
  }
  return ctx;
}

export function activeWords(book: WordBook) {
  return book.words.filter((word) => !word.isDeleted);
}

export function bookMeta(book: WordBook) {
  const words = activeWords(book);
  const memorized = words.filter(
    (w) => w.memorizationStatus === "memorized",
  ).length;
  const rate =
    words.length === 0 ? 0 : Math.round((memorized / words.length) * 100);
  return { count: words.length, memorized, rate };
}
