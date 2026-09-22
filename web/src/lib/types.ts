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
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export interface WordBook {
  id: string;
  title: string;
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
}
