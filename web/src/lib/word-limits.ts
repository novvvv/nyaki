/** 단어 칸 길이 한도. 서버(api/app/vocab/schemas.py)와 같은 값이다. */
export const WORD_LIMITS = {
  term: 500,
  pronunciation: 500,
  meaning: 2000,
  example: 2000,
  exampleMeaning: 2000,
  description: 5000,
  tags: 20,
  tag: 50,
} as const;
