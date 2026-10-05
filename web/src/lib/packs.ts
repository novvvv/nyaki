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
    id: "conan-highway-last-dance",
    title: "라스트 댄스 그대와 함께",
    source: "명탐정 코난 하이웨이의 타천사 OST",
    tags: ["일본어"],
    updatedAt: "2026-10-05",
    // 가사 원문은 저작권 때문에 싣지 않는다 — 단어와 뜻만 넣는다.
    words: [
      { term: "キラキラ", meaning: "반짝반짝", level: "N3" },
      { term: "揺れる", reading: "ゆれる", meaning: "흔들리다", level: "N3" },
      { term: "願い", reading: "ねがい", meaning: "소원", level: "N3" },
      { term: "叶う", reading: "かなう", meaning: "이루어지다", level: "N1" },
      { term: "あなた", meaning: "당신, 그대", level: "N5" },
      { term: "色", reading: "いろ", meaning: "색", level: "N5" },
      {
        term: "見つける",
        reading: "みつける",
        meaning: "찾다, 발견하다",
        level: "N4",
      },
      { term: "空", reading: "そら", meaning: "하늘", level: "N5" },
      {
        term: "見上げる",
        reading: "みあげる",
        meaning: "올려다보다",
        level: "N2",
      },
      { term: "誰", reading: "だれ", meaning: "누구", level: "N5" },
      { term: "何", reading: "なに", meaning: "무엇", level: "N5" },
      {
        term: "抱きしめる",
        reading: "だきしめる",
        meaning: "껴안다",
        level: "N2",
      },
      {
        term: "時間",
        reading: "じかん",
        meaning: "시간 (가사에서는 とき로 읽음)",
        level: "N5",
      },
      { term: "砂", reading: "すな", meaning: "모래", level: "N3" },
      { term: "落ちる", reading: "おちる", meaning: "떨어지다", level: "N4" },
      { term: "いつも", meaning: "언제나, 늘", level: "N5" },
      {
        term: "大事",
        reading: "だいじ",
        meaning: "소중함, 중요함",
        level: "N4",
      },
      {
        term: "笑い合う",
        reading: "わらいあう",
        meaning: "서로 웃다",
        level: "N3",
      },
      { term: "終わる", reading: "おわる", meaning: "끝나다", level: "N5" },
      {
        term: "気づく",
        reading: "きづく",
        meaning: "깨닫다, 알아차리다",
        level: "N3",
      },
      { term: "結局", reading: "けっきょく", meaning: "결국", level: "N3" },
      { term: "胸", reading: "むね", meaning: "가슴", level: "N3" },
      { term: "中", reading: "なか", meaning: "속, 안", level: "N5" },
      { term: "ゆらゆら", meaning: "흔들흔들", level: "N2" },
      { term: "心", reading: "こころ", meaning: "마음", level: "N3" },
      {
        term: "探し出す",
        reading: "さがしだす",
        meaning: "찾아내다",
        level: "N2",
      },
      { term: "きらり", meaning: "반짝 (한순간 빛나는 모양)", level: "N1" },
      { term: "光る", reading: "ひかる", meaning: "빛나다", level: "N3" },
      { term: "涙", reading: "なみだ", meaning: "눈물", level: "N3" },
      { term: "ひらひら", meaning: "하늘하늘, 팔랑팔랑", level: "N2" },
      {
        term: "舞い降りる",
        reading: "まいおりる",
        meaning: "춤추듯 내려오다",
        level: "N1",
      },
      { term: "月", reading: "つき", meaning: "달", level: "N5" },
      { term: "眺める", reading: "ながめる", meaning: "바라보다", level: "N2" },
      { term: "拭く", reading: "ふく", meaning: "닦다", level: "N3" },
      { term: "届く", reading: "とどく", meaning: "닿다", level: "N3" },
      { term: "星影", reading: "ほしかげ", meaning: "별빛", level: "N1" },
      { term: "記憶", reading: "きおく", meaning: "기억", level: "N2" },
      { term: "これから", meaning: "앞으로, 지금부터", level: "N4" },
      {
        term: "無くなる",
        reading: "なくなる",
        meaning: "없어지다, 사라지다",
        level: "N4",
      },
      { term: "痛み", reading: "いたみ", meaning: "아픔", level: "N3" },
      { term: "知る", reading: "しる", meaning: "알다", level: "N5" },
      {
        term: "優しさ",
        reading: "やさしさ",
        meaning: "다정함, 상냥함",
        level: "N3",
      },
      { term: "風", reading: "かぜ", meaning: "바람", level: "N4" },
      {
        term: "纏う",
        reading: "まとう",
        meaning: "두르다, 휘감다",
        level: "N1",
      },
      {
        term: "贈る",
        reading: "おくる",
        meaning: "선물하다, 보내다",
        level: "N3",
      },
      { term: "両手", reading: "りょうて", meaning: "양손", level: "N3" },
      { term: "いっぱい", meaning: "가득", level: "N4" },
      { term: "花", reading: "はな", meaning: "꽃", level: "N5" },
      {
        term: "舞い上がる",
        reading: "まいあがる",
        meaning: "날아오르다",
        level: "N1",
      },
      {
        term: "面影",
        reading: "おもかげ",
        meaning: "(기억 속의) 모습",
        level: "N1",
      },
      { term: "さよなら", meaning: "안녕 (작별 인사)", level: "N5" },
      { term: "ありがとう", meaning: "고마워", level: "N5" },
    ],
  },
];

export function getPack(id: string) {
  return PACKS.find((pack) => pack.id === id);
}
