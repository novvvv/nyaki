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
  example_meaning: string | null;
  image_path: string | null;
  memorization_status: "unmemorized" | "memorized";
  is_bookmarked: boolean;
  tags: string[];
  srs_interval_days: number;
  srs_learning_step: number | null;
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
    exampleMeaning: value.example_meaning ?? undefined,
    memorizationStatus: value.memorization_status,
    srsIntervalDays: value.srs_interval_days ?? 0,
    srsLearningStep: value.srs_learning_step ?? null,
    isBookmarked: value.is_bookmarked ?? false,
    tags: value.tags ?? [],
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
  const tags = (input.tags ?? [])
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
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
        example_meaning: input.exampleMeaning?.trim() || null,
        image_path: null,
        memorization_status: input.memorizationStatus ?? "unmemorized",
        is_bookmarked: input.isBookmarked ?? false,
        tags,
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

// =============== ✨ removeWordBook API ✨ =============== //
// feat
//     - 단어장 제거 API 
// parameter 
//     - token: string -> Firebase login JWT 
//     - wordBookId: string -> 단어장 ID 
// url 
//     - /v1/word-books/${workBookId}
//     - method : DELETE 
// ========================================================= //

export async function removeWordBook(
  token: string,
  wordBookId: string,
): Promise<void> {
  await request<void>(`/v1/word-books/${wordBookId}`, token, {
    method: "DELETE",
  });
}

// =============== ✨ completeQuest API ✨ =============== //
// feat
//     - 게이미피케이션 퀘스트 완료 신고. 서버가 idempotent 처리(오늘 이미
//       완료했으면 중복 지급 없이 현재 상태만 반환) — 호출부는 실패해도
//       원래 하려던 동작(단어 추가 등)을 막지 않는 best-effort로 다뤄야 함.
// parameter
//     - token: string -> Firebase login JWT
//     - questId: string -> 퀘스트 식별자 (예: 'add_word')
// url
//     - /v1/progress/quests/${questId}/complete
//     - method : POST
// ========================================================= //

export async function completeQuest(
  token: string,
  questId: string,
): Promise<void> {
  await request<unknown>(`/v1/progress/quests/${questId}/complete`, token, {
    method: "POST",
  });
}

// ==================== 복습 ====================

export type ReviewGrade = "again" | "good";

export interface ReviewGradeItem {
  /** 클라이언트가 만든 고유 id. 재전송해도 서버가 한 번만 반영하게 하는 열쇠다. */
  id: string;
  wordId: string;
  grade: ReviewGrade;
  reviewedAt: string;
}

export interface GradePreview {
  againSeconds: number;
  goodSeconds: number;
}

export interface DueWords {
  words: Word[];
  /** 단어 id → 버튼에 띄울 다음 간격. 서버가 SM-2로 계산한 값이다. */
  previews: Record<string, GradePreview>;
}

export async function fetchDueWords(
  token: string,
  limit: number,
): Promise<DueWords> {
  const body = await request<{
    words: ApiWord[];
    previews: Record<string, { again_seconds: number; good_seconds: number }>;
  }>(`/v1/review/due?limit=${limit}`, token);

  const previews: Record<string, GradePreview> = {};
  for (const [id, value] of Object.entries(body.previews ?? {})) {
    previews[id] = {
      againSeconds: value.again_seconds,
      goodSeconds: value.good_seconds,
    };
  }
  return { words: body.words.map(toWord), previews };
}

export interface DueCounts {
  total: number;
  /** 단어장 id → due 개수. due가 0인 단어장은 들어있지 않다. */
  byBook: Record<string, number>;
}

/**
 * 복습 대상 개수만 받아온다.
 *
 * /v1/review/due는 한 번에 최대 200개라 응답 길이로 개수를 세면 201개부터
 * 틀린다. 이쪽은 서버가 COUNT만 하므로 상한이 없다.
 */
export async function fetchDueCounts(token: string): Promise<DueCounts> {
  const body = await request<{ total: number; by_book: Record<string, number> }>(
    "/v1/review/due/count",
    token,
  );
  return { total: body.total, byBook: body.by_book };
}

export interface Progress {
  churuBalance: number;
  capelinBalance: number;
  completedToday: string[];
  /** 하루에 새로 배울 단어 수 — 안키의 "새 카드/일" */
  dailyNewLimit: number;
  /** 하루 복습 상한 — 안키의 "최대 복습량/일". 9999면 사실상 무제한 */
  dailyReviewLimit: number;
  /** 학습 단계(분). 빈 배열이면 단계 없이 바로 일 단위로 간다 */
  learningSteps: number[];
  /** 재학습 단계(분) — 복습 카드가 틀렸을 때 */
  relearningSteps: number[];
  /** 마지막 단계를 통과했을 때의 간격(일) */
  graduatingIntervalDays: number;
}

type ApiProgress = {
  churu_balance: number;
  capelin_balance: number;
  completed_today: string[];
  daily_new_limit: number;
  daily_review_limit: number;
  learning_steps: number[];
  relearning_steps: number[];
  graduating_interval_days: number;
};

function toProgress(value: ApiProgress): Progress {
  return {
    churuBalance: value.churu_balance,
    capelinBalance: value.capelin_balance,
    completedToday: value.completed_today,
    dailyNewLimit: value.daily_new_limit,
    dailyReviewLimit: value.daily_review_limit,
    learningSteps: value.learning_steps,
    relearningSteps: value.relearning_steps,
    graduatingIntervalDays: value.graduating_interval_days,
  };
}

export async function fetchProgress(token: string): Promise<Progress> {
  return toProgress(await request<ApiProgress>("/v1/progress", token));
}

export interface SettingsInput {
  dailyNewLimit?: number;
  dailyReviewLimit?: number;
  /** "1,10" 또는 "1 10". 빈 문자열이면 단계를 끈다. */
  learningSteps?: string;
  relearningSteps?: string;
  graduatingIntervalDays?: number;
}

/** 학습 설정 변경. 보낸 항목만 바뀐다. */
export async function updateSettings(
  token: string,
  settings: SettingsInput,
): Promise<Progress> {
  const body: Record<string, number | string> = {};
  const { dailyNewLimit, dailyReviewLimit } = settings;
  if (dailyNewLimit !== undefined) body.daily_new_limit = dailyNewLimit;
  if (dailyReviewLimit !== undefined) body.daily_review_limit = dailyReviewLimit;
  if (settings.learningSteps !== undefined)
    body.learning_steps = settings.learningSteps;
  if (settings.relearningSteps !== undefined)
    body.relearning_steps = settings.relearningSteps;
  if (settings.graduatingIntervalDays !== undefined)
    body.graduating_interval_days = settings.graduatingIntervalDays;

  return toProgress(
    await request<ApiProgress>("/v1/progress/settings", token, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  );
}

function gradesBody(grades: ReviewGradeItem[]) {
  return JSON.stringify({
    grades: grades.map((g) => ({
      id: g.id,
      word_id: g.wordId,
      grade: g.grade,
      reviewed_at: g.reviewedAt,
    })),
  });
}

export async function pushGrades(
  token: string,
  grades: ReviewGradeItem[],
): Promise<{ applied: number; skipped: number; missing: number }> {
  return request("/v1/review/grades", token, {
    method: "POST",
    body: gradesBody(grades),
  });
}

/**
 * 탭이 닫히는 중에도 채점 결과를 보낸다.
 *
 * `navigator.sendBeacon`은 커스텀 헤더를 못 붙여서 Authorization 토큰을 실을 수
 * 없다. `keepalive`는 헤더를 붙일 수 있고 페이지가 사라진 뒤에도 전송이 이어진다.
 * 본문 64KB 제한이 있는데 채점 100개는 10KB도 안 된다.
 *
 * 응답을 기다리지 않는다 — 중복은 서버가 id로 걸러내므로 나중에 다시 보내도 안전하다.
 */
export function pushGradesBeacon(
  token: string,
  grades: ReviewGradeItem[],
): void {
  void fetch(`${apiBaseUrl}/v1/review/grades`, {
    method: "POST",
    keepalive: true,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: gradesBody(grades),
  }).catch(() => {});
}
