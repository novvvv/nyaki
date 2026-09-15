// 배포용 단어 묶음 — 아직 목업 데이터다.
// 나중에 파일(public/packs/*.csv)이나 Firestore로 옮겨도 화면은 그대로 쓸 수 있도록
// 이 모듈만 바꾸면 되게 분리해 둔다.

export interface PackWord {
  term: string;
  reading?: string;
  meaning: string;
}

export interface Pack {
  id: string;
  title: string;
  source: string;
  tags: string[];
  updatedAt: string;
  words: PackWord[];
}

export const PACKS: Pack[] = [
  {
    id: "jp-intro-vol1",
    title: "일본어 입문 강의 vol1",
    source: "블로그 강의 · 인사말",
    tags: ["일본어"],
    updatedAt: "2026-09-15",
    words: [
      { term: "おはよう", meaning: "안녕 (아침 인사, 반말)" },
      { term: "おはようございます", meaning: "안녕하세요 (아침 인사, 정중)" },
      { term: "こんにちは", meaning: "안녕하세요 (낮 인사)" },
      { term: "こんばんは", meaning: "안녕하세요 (밤 인사)" },
    ],
  },
  {
    id: "jp-intro-vol4",
    title: "일본어 입문 강의 vol4",
    source: "블로그 강의",
    tags: ["일본어"],
    updatedAt: "2026-09-02",
    words: [
      { term: "私", reading: "わたし", meaning: "나, 저" },
      { term: "学生", reading: "がくせい", meaning: "학생" },
      { term: "先生", reading: "せんせい", meaning: "선생님" },
      { term: "学校", reading: "がっこう", meaning: "학교" },
      { term: "友達", reading: "ともだち", meaning: "친구" },
      { term: "今日", reading: "きょう", meaning: "오늘" },
      { term: "明日", reading: "あした", meaning: "내일" },
      { term: "食べる", reading: "たべる", meaning: "먹다" },
      { term: "飲む", reading: "のむ", meaning: "마시다" },
      { term: "行く", reading: "いく", meaning: "가다" },
    ],
  },
];

export function getPack(id: string) {
  return PACKS.find((pack) => pack.id === id);
}
