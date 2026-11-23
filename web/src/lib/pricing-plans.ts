/**
 * 요금제 — 임시. 결제는 아직 없고, 가격 · 구성은 정식으로 열기 전에 바뀐다.
 * 요금제 페이지(/pricing)와 메인이 같이 쓴다.
 */

export interface Plan {
  id: string;
  name: string;
  price: string;
  per?: string;
  summary: string;
  features: string[];
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "무료",
    price: "₩0",
    summary: "냐키의 기본 기능을 모두 써요.",
    features: [
      "단어장 · 빈칸 노트 만들기",
      "간격 반복 복습과 통계",
      "단어 다운로드",
      "상점에서 냐키 옷 바꾸기",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "₩3,900",
    per: "/ 월",
    summary: "사진으로 외우고 싶을 때.",
    features: ["무료의 모든 기능", "카드에 사진 넣기 (최대 1,000장)"],
    highlight: true,
  },
  {
    id: "pro-plus",
    name: "Pro+",
    price: "₩6,900",
    per: "/ 월",
    summary: "많이 외우는 사람을 위해.",
    features: [
      "Pro의 모든 기능",
      "카드에 사진 넣기 (최대 5,000장)",
      "새 기능 먼저 써 보기",
    ],
  },
];
