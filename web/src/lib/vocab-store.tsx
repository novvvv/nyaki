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
  listBooks,
  putBook,
  putWord,
  removeWord,
  removeWordBook,
} from "./api-client";

import type { BookSummary } from "./api-client";
import type { Word, WordBook, WordBookInput, WordInput } from "./types";
import { newId } from "./utils";

interface VocabContextValue {
  wordBooks: WordBook[];
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
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getWordBook: (id: string) => WordBook | undefined;
  createWordBook: (input: WordBookInput) => Promise<WordBook>;
  updateWordBook: (id: string, input: WordBookInput) => Promise<WordBook>;
  createWord: (wordBookId: string, input: WordInput) => Promise<Word>;
  updateWord: (
    wordBookId: string,
    wordId: string,
    input: WordInput,
  ) => Promise<Word | undefined>;
  deleteWord: (wordBookId: string, wordId: string) => Promise<void>;
  deleteWordBook: (wordBookId: string) => Promise<void>;
}

const VocabContext = createContext<VocabContextValue | null>(null);

export function VocabProvider({ children }: { children: ReactNode }) {
  const { user, getToken } = useAuth();
  const [wordBooks, setWordBooks] = useState<WordBook[]>([]);
  const [summaries, setSummaries] = useState<Record<string, BookSummary>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setWordBooks([]);
      return;
    }
    setLoading(true);
    try {
      const [books, bookSummaries] = await Promise.all([
        listBooks(token),
        fetchBookSummaries(token),
      ]);
      setWordBooks(books);
      setSummaries(bookSummaries);
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
    setWordBooks((prev) => [created, ...prev]);
    return created;
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

    return created;
  }, [getToken]);

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
      return updated;
    },
    [getToken, wordBooks],
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
  }, [getToken]);

  const deleteWordBook = useCallback(async (wordBookId: string) => {
    const token = await getToken();
    if (!token) throw new Error("로그인이 필요합니다.");
    await removeWordBook(token, wordBookId);
    setWordBooks((prev) => prev.filter((book) => book.id !== wordBookId));
  }, [getToken]);

  const value = useMemo(
    () => ({
      wordBooks,
      summaries,
      patchSummary,
      loading,
      error,
      refresh,
      getWordBook,
      createWordBook,
      updateWordBook,
      createWord,
      updateWord,
      deleteWord,
      deleteWordBook,
    }),
    [
      wordBooks,
      summaries,
      patchSummary,
      loading,
      error,
      refresh,
      getWordBook,
      createWordBook,
      updateWordBook,
      createWord,
      updateWord,
      deleteWord,
      deleteWordBook,
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
