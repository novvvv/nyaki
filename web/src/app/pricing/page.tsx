"use client";

import { PageHeader } from "@/components/ui";
import { useAppMode } from "@/lib/app-mode";
import { cn } from "@/lib/utils";

/**
 * 요금제 — 임시 페이지. 결제는 아직 없고, 가격 · 구성은 정식으로 열기 전에 바뀐다.
 * 유료 기능(카드 사진)은 서버의 PREMIUM_UIDS로만 열려 있다(api/app/core/photos.py).
 */

interface Plan {
  id: string;
  name: string;
  price: string;
  per?: string;
  summary: string;
  features: string[];
  highlight?: boolean;
}

const PLANS: Plan[] = [
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

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="mt-0.5 size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const free = plan.id === "free";
  return (
    <li
      className={cn(
        "flex flex-col rounded-3xl border p-5",
        plan.highlight
          ? "border-ink/80 shadow-[0_6px_0_-1px_#efd6d6] dark:shadow-[0_6px_0_-1px_rgba(239,214,214,0.3)]"
          : "border-taupe/70",
      )}
    >
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold tracking-tight text-ink">
          {plan.name}
        </h2>
        {!free ? (
          <span className="rounded-full bg-[#efd6d6] px-2 py-0.5 text-[11px] font-semibold text-ink dark:bg-[#efd6d6]/25">
            준비 중
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-ink/45">{plan.summary}</p>
      <p className="mt-4 text-ink">
        <span className="text-3xl font-bold tracking-tight tabular-nums">
          {plan.price}
        </span>
        {plan.per ? (
          <span className="ml-1 text-sm text-ink/45">{plan.per}</span>
        ) : null}
      </p>
      <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm text-ink/75">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <Check />
            {feature}
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled
        className={cn(
          "mt-5 w-full rounded-full py-2.5 text-sm font-medium",
          free ? "border border-taupe/70 text-ink/55" : "bg-ink/10 text-ink/40",
        )}
      >
        {free ? "기본 플랜" : "준비 중"}
      </button>
    </li>
  );
}

export default function PricingPage() {
  const appMode = useAppMode();

  const body = (
    <>
      <div className="mb-6 rounded-2xl border border-dashed border-taupe/70 bg-[#f7e9e9]/60 px-4 py-3 text-sm text-ink/70 dark:bg-[#efd6d6]/10">
        <p className="font-semibold text-ink">임시 페이지예요</p>
        <p className="mt-1">
          가격과 구성은 정식으로 열기 전에 바뀔 수 있어요. 지금은 결제할 수
          없고, 유료 플랜은 준비 중이에요.
        </p>
      </div>
      <ul className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
      </ul>
      <p className="mt-6 text-xs text-ink/40">
        표시된 가격은 부가세 포함 예정가예요.
      </p>
    </>
  );

  if (appMode) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col px-5 pb-10 pt-5 break-keep">
        <div className="mb-5">
          <h1 className="text-[22px] font-bold tracking-tight text-ink">
            요금제
          </h1>
          <p className="mt-1 text-xs text-ink/45">
            더 많은 기능이 필요할 때 골라 보세요.
          </p>
        </div>
        {body}
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl break-keep px-8 py-14 lg:px-12">
      <PageHeader
        title="요금제"
        description="더 많은 기능이 필요할 때 골라 보세요."
      />
      {body}
    </main>
  );
}
