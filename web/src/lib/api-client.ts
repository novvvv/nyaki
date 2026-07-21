import type { Word, WordBook, WordBookInput, WordInput } from "./types";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type ApiWordBook = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
};

type ApiWord = {
  id: string;
  word_book_id: string;
  term: string;
  meaning: string;
  pronunciation: string | null;
  description: string | null;
  example: string | null;
  image_path: string | null;
  memorization_status: "unmemorized" | "memorized";
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
};

function toWordBook(value: ApiWordBook): WordBook {
  return {
    id: value.id,
    title: value.title,
    description: value.description ?? undefined,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
    words: [],
  };
}

function toWord(value: ApiWord): Word {
  return {
    id: value.id,
    wordBookId: value.word_book_id,
    term: value.term,
    meaning: value.meaning,
    pronunciation: value.pronunciation ?? undefined,
    description: value.description ?? undefined,
    example: value.example ?? undefined,
    memorizationStatus: value.memorization_status,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
    isDeleted: value.is_deleted,
  };
}

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? "서버 요청에 실패했습니다.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function now() {
  return new Date().toISOString();
}

export async function listBooks(token: string): Promise<WordBook[]> {
  const books = await request<ApiWordBook[]>("/v1/word-books", token);
  return Promise.all(
    books.map(async (book) => {
      const words = await request<ApiWord[]>(
        `/v1/word-books/${book.id}/words`,
        token,
      );
      return { ...toWordBook(book), words: words.map(toWord) };
    }),
  );
}

export async function putBook(
  token: string,
  id: string,
  input: WordBookInput,
): Promise<WordBook> {
  const timestamp = now();
  const book = await request<ApiWordBook>(`/v1/word-books/${id}`, token, {
    method: "PUT",
    body: JSON.stringify({
      id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      created_at: timestamp,
      updated_at: timestamp,
      is_deleted: false,
    }),
  });
  return toWordBook(book);
}

export async function putWord(
  token: string,
  wordBookId: string,
  id: string,
  input: WordInput,
  createdAt = now(),
): Promise<Word> {
  const word = await request<ApiWord>(
    `/v1/word-books/${wordBookId}/words/${id}`,
    token,
    {
      method: "PUT",
      body: JSON.stringify({
        id,
        word_book_id: wordBookId,
        term: input.term.trim(),
        meaning: input.meaning.trim(),
        pronunciation: input.pronunciation?.trim() || null,
        description: input.description?.trim() || null,
        example: input.example?.trim() || null,
        image_path: null,
        memorization_status: "unmemorized",
        created_at: createdAt,
        updated_at: now(),
        is_deleted: false,
      }),
    },
  );
  return toWord(word);
}

export async function removeWord(
  token: string,
  wordBookId: string,
  wordId: string,
): Promise<void> {
  await request<void>(`/v1/word-books/${wordBookId}/words/${wordId}`, token, {
    method: "DELETE",
  });
}
