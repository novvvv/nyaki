// 배포용 단어 묶음 — 아직 목업 데이터다.
// 나중에 파일(public/packs/*.csv)이나 Firestore로 옮겨도 화면은 그대로 쓸 수 있도록
// 이 모듈만 바꾸면 되게 분리해 둔다.

export type JlptLevel = "N1" | "N2" | "N3" | "N4" | "N5";

// 사이트는 흑백이라 레벨 표시에만 색이 들어간다 — 쉬울수록 차분하게, 어려울수록 따뜻하게.
export const LEVEL_TONE: Record<JlptLevel, string> = {
  N5: "bg-emerald-50 text-emerald-700",
  N4: "bg-sky-50 text-sky-700",
  N3: "bg-amber-50 text-amber-700",
  N2: "bg-orange-50 text-orange-700",
  N1: "bg-rose-50 text-rose-700",
};

export interface PackWord {
  term: string;
  reading?: string;
  meaning: string;
  /** JLPT 레벨 — 공식 목록이 없어 비공식 목록 기준 추정치다. */
  level?: JlptLevel;
  /** 그림 카드. 담을 때는 빠진다 — 단어에 그림 칸이 아직 없다. */
  image?: { src: string; width: number; height: number };
}

export interface Pack {
  id: string;
  title: string;
  source: string;
  tags: string[];
  updatedAt: string;
  /** 팩 겉면 그림. */
  cover?: string;
  words: PackWord[];
}

// J-POP 가사 묶음은 내렸다 — 나중에 다시 올린다.
export const PACKS: Pack[] = [
  {
    id: "jlpt-n5-picture",
    title: "JLPT N5 그림 단어 팩",
    source: "냐키 그림 단어장",
    tags: ["일본어", "JLPT"],
    updatedAt: "2026-11-20",
    cover: "/nyaki/default/angry.webp",
    words: [
      {
        term: "秋",
        reading: "あき",
        meaning: "가을",
        level: "N5",
        image: { src: "/cards/N5_1_aki.webp", width: 720, height: 793 },
      },
      {
        term: "朝",
        reading: "あさ",
        meaning: "아침",
        level: "N5",
        image: { src: "/cards/N5_2_asa.webp", width: 720, height: 965 },
      },
      {
        term: "朝ご飯",
        reading: "あさごはん",
        meaning: "아침밥",
        level: "N5",
        image: { src: "/cards/N5_3_asagohang.webp", width: 440, height: 500 },
      },
    ],
  },
];

export function getPack(id: string) {
  return PACKS.find((pack) => pack.id === id);
}
