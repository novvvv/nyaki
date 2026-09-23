export type MemorizationStatus = "unmemorized" | "memorized";

export interface Word {
  id: string;
  wordBookId: string;
  term: string;
  meaning: string;
  pronunciation?: string;
  description?: string;
  example?: string;
  exampleMeaning?: string;
  memorizationStatus: MemorizationStatus;
  isBookmarked: boolean;
  tags: string[];
  /**
   * SM-2가 잡아둔 다음 복습 간격(일). 암기율 계산의 입력이다.
   *
   * 서버는 항상 내려주지만 시드 데이터에는 없어서 선택 필드로 둔다.
   * 없으면 0(= 아직 학습 안 함)으로 본다.
   */
  srsIntervalDays?: number;
  /**
   * 지금 몇 번째 학습 단계인지. null이면 학습 단계가 아니다.
   * 세션 안에서 이 카드를 다시 보여줄지 정할 때 쓴다 — 계산은 서버가 한다.
   */
  srsLearningStep?: number | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

/**
 * 카드 종류 — 안키의 카드 템플릿에 해당한다.
 * recognition 単語→뜻 · recall 뜻→単語 · cloze 예문 빈칸
 */
export type CardKind = "recognition" | "recall" | "cloze";

export const CARD_KIND_LABELS: Record<CardKind, string> = {
  recognition: "단어 → 뜻",
  recall: "뜻 → 단어",
  cloze: "예문 빈칸",
};

export interface WordBook {
  id: string;
  title: string;
  /** 이 단어장이 만드는 카드 종류. 비어 있으면 recognition 하나. */
  cardKinds?: CardKind[];
  description?: string;
  createdAt: string;
  updatedAt: string;
  words: Word[];
}

export interface WordInput {
  term: string;
  meaning: string;
  pronunciation?: string;
  description?: string;
  example?: string;
  exampleMeaning?: string;
  isBookmarked?: boolean;
  tags?: string[];
  memorizationStatus?: MemorizationStatus;
}

export interface WordBookInput {
  title: string;
  description?: string;
  /** 만들 카드 종류. 생략하면 서버가 기존 값을 유지한다. */
  cardKinds?: CardKind[];
}
