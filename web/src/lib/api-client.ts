import type {
  ClozeNote,
  Folder,
  Word,
  WordBook,
  WordBookInput,
  WordInput,
} from "./types";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type ApiFolder = {
  id: string;
  title: string;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

type ApiWordBook = {
  id: string;
  title: string;
  folder_id: string | null;
  sort_order: number | null;
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
    folderId: value.folder_id ?? undefined,
    sortOrder: value.sort_order ?? undefined,
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

function toFolder(value: ApiFolder): Folder {
  return {
    id: value.id,
    title: value.title,
    sortOrder: value.sort_order ?? undefined,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

export async function listFolders(token: string): Promise<Folder[]> {
  const folders = await request<ApiFolder[]>("/v1/folders", token);
  return folders.map(toFolder);
}

export async function putFolder(
  token: string,
  id: string,
  title: string,
  options: { sortOrder?: number; createdAt?: string } = {},
): Promise<Folder> {
  const timestamp = now();
  const folder = await request<ApiFolder>(`/v1/folders/${id}`, token, {
    method: "PUT",
    body: JSON.stringify({
      id,
      title: title.trim(),
      ...(options.sortOrder !== undefined
        ? { sort_order: options.sortOrder }
        : {}),
      // 그대로 덮어쓰므로(exclude_unset), now()를 보내면 생성 시각이 바뀐다.
      created_at: options.createdAt ?? timestamp,
      updated_at: timestamp,
      is_deleted: false,
    }),
  });
  return toFolder(folder);
}

/** 폴더와 **그 안의 단어장까지** 지운다. 화면이 미리 알려준 뒤에 부른다. */
export async function removeFolder(token: string, id: string): Promise<void> {
  await request<void>(`/v1/folders/${id}`, token, { method: "DELETE" });
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
  // 수정할 때는 원래 생성 시각을 그대로 보내야 한다. 서버는 보낸 필드를
  // 그대로 덮어쓰므로(exclude_unset), now()를 보내면 생성 시각이 바뀐다.
  createdAt = now(),
): Promise<WordBook> {
  const timestamp = now();
  const book = await request<ApiWordBook>(`/v1/word-books/${id}`, token, {
    method: "PUT",
    body: JSON.stringify({
      id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      // 안 보내면 서버가 기존 값을 유지한다(exclude_unset).
      ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
      // null은 "폴더 밖으로 꺼내기"라 undefined와 구분해서 보낸다.
      ...(input.folderId !== undefined ? { folder_id: input.folderId } : {}),
      created_at: createdAt,
      updated_at: timestamp,
      is_deleted: false,
    }),
  });
  return toWordBook(book);
}

type ApiClozeNote = {
  id: string;
  word_book_id: string;
  text: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
};

function toClozeNote(value: ApiClozeNote): ClozeNote {
  return {
    id: value.id,
    wordBookId: value.word_book_id,
    text: value.text,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

export interface BookSummary {
  wordBookId: string;
  /** 단어 + 빈칸 노트 */
  itemCount: number;
  cardCount: number;
  masteryRate: number;
  /**
   * 암기 단계별 카드 수 — 새 카드 · 학습 중 · 1일 · 3일 · 1주 · 1달+ 순(6칸).
   * 다음 복습 간격으로 나눈 것이고, 앞 둘이 X, 나머지가 OK다.
   */
  stages: number[];
}

/** 단어장별 집계. 숫자는 서버가 센다 — 클라이언트가 각자 세면 값이 갈린다. */
export async function fetchBookSummaries(
  token: string,
): Promise<Record<string, BookSummary>> {
  const rows = await request<
    {
      word_book_id: string;
      item_count: number;
      card_count: number;
      mastery_rate: number;
      stages?: number[];
    }[]
  >("/v1/word-books/summaries", token);

  return Object.fromEntries(
    rows.map((row) => [
      row.word_book_id,
      {
        wordBookId: row.word_book_id,
        itemCount: row.item_count,
        cardCount: row.card_count,
        masteryRate: row.mastery_rate,
        // 새 서버 배포 전에는 오지 않는다. 비어 있으면 곡선에서 뺀다.
        stages: row.stages ?? [],
      },
    ]),
  );
}

export interface DailyAdded {
  /** YYYY-MM-DD, 보낸 시차 기준 */
  date: string;
  count: number;
}

/**
 * 날짜별 추가 개수. 단어와 빈칸 노트를 합친 수다.
 *
 * 항목을 전부 받아와서 세지 않는 이유는 차트에 필요한 게 날짜와 개수뿐이라서다 —
 * 빈칸 노트를 받아오면 문장 전체가 딸려 온다.
 *
 * 시차를 보내는 이유: 저장은 UTC지만 "며칠에 추가했나"는 로컬 날짜다.
 * getTimezoneOffset()은 KST에서 -540을 주므로 부호를 뒤집어 보낸다.
 */
export async function fetchDailyAdded(
  token: string,
  days?: number,
): Promise<DailyAdded[]> {
  const params = new URLSearchParams({
    tz_offset: String(-new Date().getTimezoneOffset()),
  });
  if (days !== undefined) params.set("days", String(days));
  return request<DailyAdded[]>(`/v1/stats/daily-added?${params}`, token);
}

/**
 * 날짜별 복습한 카드 수(최근 days일). 같은 카드를 하루에 여러 번 채점해도 1개다.
 * 0개인 날은 오지 않는다 — 빈 날짜는 화면이 채운다. 시차는 fetchDailyAdded와 같다.
 */
export async function fetchDailyReviewed(
  token: string,
  days: number,
): Promise<DailyAdded[]> {
  const params = new URLSearchParams({
    days: String(days),
    tz_offset: String(-new Date().getTimezoneOffset()),
  });
  return request<DailyAdded[]>(`/v1/stats/daily-reviewed?${params}`, token);
}

export async function fetchClozeNotes(
  token: string,
  wordBookId: string,
): Promise<ClozeNote[]> {
  const notes = await request<ApiClozeNote[]>(
    `/v1/word-books/${wordBookId}/cloze-notes`,
    token,
  );
  return notes.map(toClozeNote);
}

export async function putClozeNote(
  token: string,
  wordBookId: string,
  id: string,
  text: string,
  createdAt = now(),
): Promise<ClozeNote> {
  const note = await request<ApiClozeNote>(
    `/v1/word-books/${wordBookId}/cloze-notes/${id}`,
    token,
    {
      method: "PUT",
      body: JSON.stringify({
        id,
        word_book_id: wordBookId,
        text: text.trim(),
        created_at: createdAt,
        updated_at: now(),
        is_deleted: false,
      }),
    },
  );
  return toClozeNote(note);
}

export async function removeClozeNote(
  token: string,
  wordBookId: string,
  id: string,
): Promise<void> {
  await request<unknown>(
    `/v1/word-books/${wordBookId}/cloze-notes/${id}`,
    token,
    { method: "DELETE" },
  );
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
  /** 어느 카드를 채점했는지. 없으면 서버가 recognition으로 본다. */
  cardId?: string;
  grade: ReviewGrade;
  reviewedAt: string;
}

export interface GradePreview {
  againSeconds: number;
  goodSeconds: number;
}

export interface ClozeSegment {
  text: string;
  /** 지금 묻는 빈칸 자리 */
  blank: boolean;
  hint?: string;
}

export interface ClozeFace {
  noteId: string;
  /**
   * 문장 조각. 빈칸 자리를 **그 자리에서** 답으로 바꾸려면 위치를 알아야 한다.
   * 파싱은 서버가 한 번만 한다 — 웹·앱이 각자 하면 렌더가 갈린다.
   */
  segments: ClozeSegment[];
}

export interface DueCard {
  /** `{출처 id}:{kind}` */
  id: string;
  /** 단어 카드는 recognition·recall, 빈칸 카드는 c1·c2 … */
  kind: string;
  sourceType: "word" | "cloze";
  /** 이 카드가 속한 단어장. 빈칸 카드는 단어가 없어 서버가 알려준다. */
  wordBookId: string;
  /** 단어 카드면 채워진다. */
  word?: Word;
  /** 빈칸 카드면 채워진다. */
  cloze?: ClozeFace;
  /** 버튼에 띄울 다음 간격. 서버가 SM-2로 계산한 값이다. */
  preview: GradePreview;
}

export interface DueWords {
  cards: DueCard[];
}

export async function fetchDueWords(
  token: string,
  limit: number,
): Promise<DueWords> {
  const body = await request<{
    cards: {
      id: string;
      kind: string;
      source_type: "word" | "cloze";
      word_book_id: string;
      word: ApiWord | null;
      cloze: {
        note_id: string;
        segments: { text: string; blank: boolean; hint: string | null }[];
      } | null;
      preview: { again_seconds: number; good_seconds: number };
    }[];
  }>(`/v1/review/due?limit=${limit}`, token);

  return {
    cards: (body.cards ?? []).map((card) => ({
      id: card.id,
      kind: card.kind,
      sourceType: card.source_type ?? "word",
      wordBookId: card.word_book_id ?? card.word?.word_book_id ?? "",
      word: card.word ? toWord(card.word) : undefined,
      cloze: card.cloze
        ? {
            noteId: card.cloze.note_id,
            segments: (card.cloze.segments ?? []).map((segment) => ({
              text: segment.text,
              blank: segment.blank,
              hint: segment.hint ?? undefined,
            })),
          }
        : undefined,
      preview: {
        againSeconds: card.preview.again_seconds,
        goodSeconds: card.preview.good_seconds,
      },
    })),
  };
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
      ...(g.cardId ? { card_id: g.cardId } : {}),
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

// =============== 단어 묶음 담기 =============== //

export interface PackImport {
  id: string;
  packId: string;
  wordBookId: string;
  wordCount: number;
  importedAt: string;
}

type ApiPackImport = {
  id: string;
  pack_id: string;
  word_book_id: string;
  word_count: number;
  imported_at: string;
};

function toPackImport(value: ApiPackImport): PackImport {
  return {
    id: value.id,
    packId: value.pack_id,
    wordBookId: value.word_book_id,
    wordCount: value.word_count,
    importedAt: value.imported_at,
  };
}

export interface PackImportInput {
  /** 담기 기록 id. 재전송 때 같은 값을 보내야 서버가 중복을 알아본다. */
  id: string;
  packId: string;
  wordBookId: string;
  /** 새 단어장으로 담을 때만. 없으면 wordBookId의 기존 단어장에 담는다. */
  newBook?: { title: string; folderId: string | null };
  words: {
    id: string;
    term: string;
    pronunciation?: string;
    meaning: string;
  }[];
}

/**
 * 묶음을 단어장에 담는다. 단어장 생성 · 단어 추가 · 기록이 서버에서 한 번에
 * 처리돼, 실패하면 아무것도 남지 않는다.
 */
export async function importPack(
  token: string,
  input: PackImportInput,
): Promise<PackImport> {
  const timestamp = now();
  const record = await request<ApiPackImport>("/v1/pack-imports", token, {
    method: "POST",
    body: JSON.stringify({
      id: input.id,
      pack_id: input.packId,
      word_book_id: input.wordBookId,
      ...(input.newBook
        ? {
            word_book: {
              id: input.wordBookId,
              title: input.newBook.title.trim(),
              folder_id: input.newBook.folderId,
              created_at: timestamp,
              updated_at: timestamp,
            },
          }
        : {}),
      words: input.words.map((word) => ({
        id: word.id,
        word_book_id: input.wordBookId,
        term: word.term,
        pronunciation: word.pronunciation ?? null,
        meaning: word.meaning,
        created_at: timestamp,
        updated_at: timestamp,
      })),
    }),
  });
  return toPackImport(record);
}

/** 내가 담은 묶음. 담은 단어장이 지워진 것은 서버가 뺀다. */
export async function fetchPackImports(token: string): Promise<PackImport[]> {
  const records = await request<ApiPackImport[]>("/v1/pack-imports", token);
  return records.map(toPackImport);
}

// =============== 회원 탈퇴 =============== //

/**
 * 회원 탈퇴. 서버가 내 데이터를 전부 지우고 Firebase 계정까지 지운다.
 * 되돌릴 수 없다 — 화면이 두 번 확인받은 뒤에 부른다.
 */
export async function deleteAccount(token: string): Promise<void> {
  await request<void>("/v1/account", token, { method: "DELETE" });
}
