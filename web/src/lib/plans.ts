export type PlanId = "free" | "pro" | "premium";

export type PlanTier = "free" | "pro" | "premium";

export type PlanFeature = {
  label: string;
  hint: string;
};

export type Plan = {
  id: PlanId;
  tier: PlanTier;
  name: string;
  price: string;
  priceNote?: string;
  tagline: string;
  badge?: string;
  features: PlanFeature[];
  highlight?: boolean;
  comingSoon?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "free",
    tier: "free",
    name: "Free",
    price: "₩0",
    priceNote: "카드 없이 바로 시작",
    tagline: "앱은 마음껏, 클라우드는 가볍게",
    badge: "기본",
    features: [
      {
        label: "클라우드 단어장 세 권까지",
        hint: "단어 100개 · 웹과 앱 sync",
      },
      {
        label: "앱에서는 제한 없이 학습",
        hint: "테스트·퀘스트 포함",
      },
      {
        label: "Drive에 백업해 두기",
        hint: "기기 바꿔도 복원",
      },
      {
        label: "냥키에게 세 번 물어보기",
        hint: "뜻·예문 맛보기",
      },
      {
        label: "오늘 배울 단어 열 개",
        hint: "하루 한 번 추천",
      },
    ],
  },
  {
    id: "pro",
    tier: "pro",
    name: "Pro",
    price: "₩4,900",
    priceNote: "매월",
    tagline: "여러 기기에서 이어서, 더 넉넉하게",
    badge: "추천",
    highlight: true,
    features: [
      {
        label: "Free의 모든 것 포함",
        hint: "로컬·Drive 그대로",
      },
      {
        label: "클라우드 단어장 백 권",
        hint: "테마별로 나눠 관리",
      },
      {
        label: "단어 만 개까지 동기화",
        hint: "웹에서 모으고 앱에서 복습",
      },
      {
        label: "냥키 질의 쿠폰 스무 장",
        hint: "궁금할 때 바로",
      },
      {
        label: "하루 추천 백 개",
        hint: "루틴을 키우고 싶을 때",
      },
    ],
  },
  {
    id: "premium",
    tier: "premium",
    name: "Premium",
    price: "준비 중",
    priceNote: "조금만 기다려 주세요",
    tagline: "캡처부터 패키지까지, 한 단계 위",
    comingSoon: true,
    features: [
      {
        label: "Pro를 넘는 한도와 편의",
        hint: "상세는 곧",
      },
      {
        label: "화면에서 바로 단어 저장",
        hint: "OCR · 캡처",
      },
      {
        label: "곡·콘텐츠 패키지와 깊은 복습",
        hint: "냥키와 함께",
      },
      {
        label: "혜택과 가격은 곧 공개",
        hint: "알림으로 안내 예정",
      },
    ],
  },
];
