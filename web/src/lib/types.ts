export type MemorizationStatus = "unmemorized" | "memorized";

export interface Word {
  id: string;
  wordBookId: string;
  term: string;
  meaning: string;
  pronunciation?: string;
  description?: string;
  example?: string;
  memorizationStatus: MemorizationStatus;
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
}

export interface WordBookInput {
  title: string;
  description?: string;
}
