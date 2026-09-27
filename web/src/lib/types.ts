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

export interface Folder {
  id: string;
  title: string;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WordBook {
  id: string;
  title: string;
  /** 담긴 폴더. 없으면 폴더 밖이다. */
  folderId?: string;
  /** 사용자가 끌어서 정한 순서. 작을수록 위다. */
  sortOrder?: number;
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

/**
 * 빈칸 노트 — 안키의 Cloze 노트 타입.
 * 단어가 아니라 문장 한 덩이를 외운다. `{{c1::답}}`으로 빈칸을 찍는다.
 */
export interface ClozeNote {
  id: string;
  wordBookId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface WordBookInput {
  title: string;
  description?: string;
  /**
   * 담을 폴더. `null`을 주면 폴더 밖으로 꺼낸다.
   * 생략하면 서버가 기존 값을 유지한다(exclude_unset).
   */
  folderId?: string | null;
  /** 생략하면 서버가 기존 값을 유지한다(새 단어장이면 맨 뒤). */
  sortOrder?: number;
}
