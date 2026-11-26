import { KANJI_N5_PACKS } from "@/lib/packs-kanji-n5";

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
  /** 예문 칸에 담긴다. 한자 팩은 예시 단어(읽기 포함)를 넣는다. */
  example?: string;
  exampleMeaning?: string;
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
  /** 목록에 보이는 소개 글. */
  description?: string;
  /** 팩 겉면 글씨 — 아래 줄 이름과, 그림 대신 크게 넣을 글자. */
  face?: { label: string; glyph?: string };
  words: PackWord[];
}

/**
 * 랜딩에 펼쳐 보이는 그림 카드 3장. 그림 팩은 내렸지만 랜딩 카드는 그대로 쓴다.
 * 그림 단어를 다시 팩으로 올릴 때 여기서 옮겨 가면 된다.
 */
export const LANDING_CARDS: PackWord[] = [
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
];

// J-POP 가사 묶음과 N5 그림 단어 팩은 내렸다 — 나중에 다시 올린다.
// 팩은 덱 안에만 있다. 목록에는 덱이 나오고, 덱을 열면 팩이 나온다.
export const PACKS: Pack[] = [...KANJI_N5_PACKS];

/** 여러 팩을 묶은 덱. 덱 자체는 담지 않고, 안의 팩을 하나씩 담는다. */
export interface Deck {
  id: string;
  title: string;
  source: string;
  updatedAt: string;
  description: string;
  cover?: string;
  face: { label: string };
  packs: Pack[];
}

export const DECKS: Deck[] = [
  {
    id: "jlpt-n5-kanji",
    title: "N5 한자 덱",
    source: "상용한자 · JLPT N5 수준",
    updatedAt: "2026-11-26",
    description:
      "상용한자에서 N5 수준 한자를 골라 주제별 팩으로 나눴어요. 훈음 · 음독 · 훈독과 예시 단어까지 카드에 담겨요.",
    cover: "/nyaki/default/angry.webp",
    face: { label: "KANJI" },
    packs: KANJI_N5_PACKS,
  },
];

export function getDeck(id: string) {
  return DECKS.find((deck) => deck.id === id);
}

/** 이 팩이 들어 있는 덱. */
export function deckOf(packId: string) {
  return DECKS.find((deck) => deck.packs.some((pack) => pack.id === packId));
}

export function getPack(id: string) {
  return PACKS.find((pack) => pack.id === id);
}
