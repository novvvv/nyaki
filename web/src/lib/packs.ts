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
  {
    id: "kiminonawa-zenzenzense",
    title: "전전전세 (前前前世)",
    source: "RADWIMPS · 너의 이름은。 OST",
    tags: ["일본어"],
    updatedAt: "2026-10-07",
    // 가사 원문은 저작권 때문에 싣지 않는다 — 단어와 뜻만 넣는다.
    words: [
      {
        term: "眼",
        reading: "め",
        meaning: "눈 (보통은 目로 써요)",
        level: "N5",
      },
      { term: "遅い", reading: "おそい", meaning: "늦다", level: "N5" },
      { term: "時", reading: "とき", meaning: "때, 시간", level: "N5" },
      { term: "声", reading: "こえ", meaning: "목소리", level: "N5" },
      { term: "言う", reading: "いう", meaning: "말하다", level: "N5" },
      { term: "話す", reading: "はなす", meaning: "이야기하다", level: "N5" },
      { term: "歌", reading: "うた", meaning: "노래", level: "N5" },
      { term: "口", reading: "くち", meaning: "입", level: "N5" },
      { term: "手", reading: "て", meaning: "손", level: "N5" },
      { term: "何", reading: "なに", meaning: "무엇", level: "N5" },
      { term: "誰", reading: "だれ", meaning: "누구", level: "N5" },
      { term: "知る", reading: "しる", meaning: "알다", level: "N5" },
      { term: "身体", reading: "からだ", meaning: "몸", level: "N5" },
      { term: "はじめる", meaning: "시작하다", level: "N5" },
      { term: "君", reading: "きみ", meaning: "너", level: "N4" },
      { term: "僕", reading: "ぼく", meaning: "나", level: "N4" },
      { term: "やっと", meaning: "겨우, 이제야", level: "N4" },
      { term: "怒る", reading: "おこる", meaning: "화내다", level: "N4" },
      { term: "髪", reading: "かみ", meaning: "머리카락", level: "N4" },
      { term: "昔", reading: "むかし", meaning: "옛날", level: "N4" },
      {
        term: "生まれる",
        reading: "うまれる",
        meaning: "태어나다",
        level: "N4",
      },
      { term: "探す", reading: "さがす", meaning: "찾다", level: "N4" },
      { term: "笑う", reading: "わらう", meaning: "웃다", level: "N4" },
      { term: "痛い", reading: "いたい", meaning: "아프다", level: "N4" },
      { term: "同じ", reading: "おなじ", meaning: "같다", level: "N4" },
      { term: "眠る", reading: "ねむる", meaning: "잠들다", level: "N4" },
      { term: "間", reading: "あいだ", meaning: "동안, 사이", level: "N4" },
      { term: "全部", reading: "ぜんぶ", meaning: "전부", level: "N4" },
      {
        term: "壊す",
        reading: "こわす",
        meaning: "망가뜨리다, 부수다",
        level: "N4",
      },
      {
        term: "止める",
        reading: "とめる",
        meaning: "멈추게 하다, 막다",
        level: "N4",
      },
      { term: "立てる", reading: "たてる", meaning: "세우다", level: "N4" },
      { term: "消える", reading: "きえる", meaning: "사라지다", level: "N4" },
      {
        term: "覚ます",
        reading: "さます",
        meaning: "(잠을) 깨다, (눈을) 뜨다",
        level: "N3",
      },
      { term: "合わせる", reading: "あわせる", meaning: "맞추다", level: "N3" },
      {
        term: "飛ばす",
        reading: "とばす",
        meaning: "(속도를 내서) 달리다, 날리다",
        level: "N3",
      },
      { term: "心", reading: "こころ", meaning: "마음", level: "N3" },
      { term: "胸", reading: "むね", meaning: "가슴", level: "N3" },
      { term: "離す", reading: "はなす", meaning: "놓다, 떼다", level: "N3" },
      {
        term: "迷う",
        reading: "まよう",
        meaning: "헤매다, 망설이다",
        level: "N3",
      },
      { term: "物語", reading: "ものがたり", meaning: "이야기", level: "N3" },
      { term: "涙", reading: "なみだ", meaning: "눈물", level: "N3" },
      { term: "旗", reading: "はた", meaning: "깃발", level: "N3" },
      {
        term: "諦める",
        reading: "あきらめる",
        meaning: "포기하다",
        level: "N3",
      },
      { term: "握る", reading: "にぎる", meaning: "쥐다, 잡다", level: "N3" },
      {
        term: "全然",
        reading: "ぜんぜん",
        meaning: "완전히, 전혀",
        level: "N3",
      },
      {
        term: "出逢う",
        reading: "であう",
        meaning: "(우연히) 만나다",
        level: "N3",
      },
      { term: "痛み", reading: "いたみ", meaning: "아픔", level: "N3" },
      { term: "愛する", reading: "あいする", meaning: "사랑하다", level: "N3" },
      {
        term: "追い越す",
        reading: "おいこす",
        meaning: "앞지르다",
        level: "N2",
      },
      {
        term: "吸い込む",
        reading: "すいこむ",
        meaning: "들이마시다, 빨아들이다",
        level: "N2",
      },
      { term: "姿", reading: "すがた", meaning: "모습", level: "N2" },
      { term: "映す", reading: "うつす", meaning: "비추다", level: "N2" },
      {
        term: "騒がしい",
        reading: "さわがしい",
        meaning: "시끄럽다, 소란스럽다",
        level: "N2",
      },
      {
        term: "奪い取る",
        reading: "うばいとる",
        meaning: "빼앗다",
        level: "N2",
      },
      { term: "宇宙", reading: "うちゅう", meaning: "우주", level: "N2" },
      { term: "むしろ", meaning: "오히려, 차라리", level: "N2" },
      {
        term: "語る",
        reading: "かたる",
        meaning: "이야기하다, 들려주다",
        level: "N2",
      },
      { term: "前世", reading: "ぜんせ", meaning: "전생", level: "N1" },
      { term: "瞳", reading: "ひとみ", meaning: "눈동자", level: "N1" },
      { term: "遥か", reading: "はるか", meaning: "아득히, 훨씬", level: "N1" },
      { term: "銀河", reading: "ぎんが", meaning: "은하", level: "N1" },
      { term: "果て", reading: "はて", meaning: "끝", level: "N1" },
      { term: "革命", reading: "かくめい", meaning: "혁명", level: "N1" },
      { term: "前夜", reading: "ぜんや", meaning: "전날 밤", level: "N1" },
      {
        term: "戯れる",
        reading: "たわむれる",
        meaning: "장난치다, 놀다",
        level: "N1",
      },
      { term: "じゃれる", meaning: "(장난치며) 놀다", level: "N1" },
      { term: "いざ", meaning: "막상, 정작", level: "N1" },
      { term: "めがける", meaning: "겨냥하다, 목표로 하다", level: "N1" },
      { term: "ぶきっちょ", meaning: "서투름, 어설픔", level: "N1" },
      {
        term: "散り散り",
        reading: "ちりぢり",
        meaning: "뿔뿔이 흩어짐",
        level: "N1",
      },
      {
        term: "口ずさむ",
        reading: "くちずさむ",
        meaning: "흥얼거리다",
        level: "N1",
      },
      { term: "光年", reading: "こうねん", meaning: "광년", level: "N1" },
    ],
  },
];

export function getPack(id: string) {
  return PACKS.find((pack) => pack.id === id);
}
