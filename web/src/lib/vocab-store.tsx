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
  listBooks,
  putBook,
  putWord,
  removeWord,
  removeWordBook,
} from "./api-client";

import type { Word, WordBook, WordBookInput, WordInput } from "./types";

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

interface VocabContextValue {
  wordBooks: WordBook[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getWordBook: (id: string) => WordBook | undefined;
  createWordBook: (input: WordBookInput) => Promise<WordBook>;
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
      setWordBooks(await listBooks(token));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "목록을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void refresh();
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

  const createWord = useCallback(async (wordBookId: string, input: WordInput) => {
    const token = await getToken();
    if (!token) throw new Error("로그인이 필요합니다.");
    const created = await putWord(token, wordBookId, newId("word"), input);

    setWordBooks((prev) =>
      prev.map((book) =>
        book.id === wordBookId
          ? { ...book, words: [created, ...book.words], updatedAt: created.updatedAt }
          : book,
      ),
    );
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
      loading,
      error,
      refresh,
      getWordBook,
      createWordBook,
      createWord,
      updateWord,
      deleteWord,
      deleteWordBook,
    }),
    [
      wordBooks,
      loading,
      error,
      refresh,
      getWordBook,
      createWordBook,
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
