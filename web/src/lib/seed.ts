import type { WordBook } from "./types";

const now = new Date().toISOString();

export const seedWordBooks: WordBook[] = [
  {
    id: "default-nyaki",
    title: "냥키",
    description: "Nyaki 기본 단어장",
    createdAt: now,
    updatedAt: now,
    words: [
      {
        id: "word-1",
        wordBookId: "default-nyaki",
        term: "cat",
        meaning: "고양이",
        pronunciation: "/kæt/",
        example: "I have a cat.",
        memorizationStatus: "memorized",
        isBookmarked: true,
        tags: ["기초"],
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      },
      {
        id: "word-2",
        wordBookId: "default-nyaki",
        term: "study",
        meaning: "공부하다",
        memorizationStatus: "unmemorized",
        isBookmarked: false,
        tags: [],
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      },
    ],
  },
  {
    id: "book-jpop",
    title: "J-POP 가사",
    description: "노래에서 모은 표현",
    createdAt: now,
    updatedAt: now,
    words: [
      {
        id: "word-3",
        wordBookId: "book-jpop",
        term: "夜",
        meaning: "밤",
        pronunciation: "よる",
        memorizationStatus: "unmemorized",
        isBookmarked: false,
        tags: ["J-POP"],
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      },
    ],
  },
];
