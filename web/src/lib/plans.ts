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
};

export const PLANS: Plan[] = [
  {
    id: "free",
    tier: "free",
    name: "Free",
    price: "₩0",
    priceNote: "영구 무료 · 카드 등록 없음",
    tagline: "앱에서 본격 학습, 웹은 가볍게",
    badge: "기본",
    features: [
      { label: "앱 로컬 단어장·테스트·퀘스트", hint: "오프라인·무제한" },
      { label: "웹 Hub 단어 100개", hint: "앱과 sync" },
      { label: "공유 단어장 담기", hint: "쿼터 포함" },
      { label: "Drive 수동 백업", hint: "Hub와 별도" },
    ],
  },
  {
    id: "pro",
    tier: "pro",
    name: "Pro",
    price: "₩4,900",
    priceNote: "월 구독",
    tagline: "폰·웹·태블릿, 같은 단어장",
    badge: "추천",
    highlight: true,
    features: [
      { label: "Free 기능 전부 포함", hint: "기존 데이터 유지" },
      { label: "기기 간 Hub sync", hint: "외운 표시도 sync" },
      { label: "웹 단어 한도 확대", hint: "100개 이상" },
      { label: "Drive 자동 백업", hint: "주기 저장" },
    ],
  },
  {
    id: "premium",
    tier: "premium",
    name: "Premium",
    price: "₩29,000",
    priceNote: "월 구독",
    tagline: "캡처·패키지·냥키까지",
    features: [
      { label: "Pro 기능 전부 포함", hint: "Pro + α" },
      { label: "웹 단어 거의 무제한", hint: "대량 저장" },
      { label: "OCR · 캡처 저장", hint: "화면에서 추출" },
      { label: "패키지 · 냥키 LLM", hint: "고급 복습" },
    ],
  },
];
