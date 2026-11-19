"use client";

import Link from "next/link";

import { useAuth } from "@/components/auth-provider";

// import { PricingSection } from "@/components/pricing-section"; // 플랜 섹션 일단 주석처리

// 웹에서 지금 쓸 수 있는 것만 소개한다. iOS 앱은 아직 없다.
const FEATURES = [
  {
    title: "알아서 복습",
    body: "‘모름 / 외움’만 고르면 다음 복습일은 냐키가 정한다냥.",
  },
  {
    title: "단어 묶음 담기",
    body: "내가 직접 정리한 J-POP 가사 속 단어들, 클릭 한 번에 싹 담아보라냥.",
  },
  {
    title: "빈칸 노트",
    body: "가사와 문장 속 빈칸을 채우면서 뉘앙스랑 개념까지 확실히 외운다냥.",
  },
];

/** 로그인한 사람의 메인 — 예전처럼 고양이만. */
function CatOnly() {
  return (
    <main className="flex min-h-[calc(100vh-8.5rem)] flex-col items-center justify-center px-6 py-16">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/nyaki_normal.webp"
        alt="Nyaki 고양이"
        width={1792}
        height={2400}
        className="block h-auto w-[min(380px,80vw)]"
      />
    </main>
  );
}

/** 메인. 로그인 안 한 사람에게는 냐키가 무엇인지 알려주는 짧은 랜딩을 보여준다. */
export default function HomePage() {
  const { ready, user } = useAuth();
  // 로그인 상태를 확인하는 동안에도 고양이만 — 로그인한 사람에게 랜딩이 번쩍이지 않게.
  if (!ready || user) return <CatOnly />;

  return (
    <main className="mx-auto w-full max-w-4xl break-keep px-6 py-16 sm:py-24">
      <section className="flex flex-col items-center pt-8 text-center sm:pt-12">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          잊을 때쯤 다시 묻는 똑똑한 단어장이다냥
        </h1>
        <p className="mt-3 text-sm text-ink/55 sm:text-base">
          외웠는지만 알려줘라냥. 복습 일정은 냐키가 알아서 챙긴다냥!
        </p>
        {/* 복습 화면의 외움 · 모름 버튼과 같은 모양. 로그인이 외움(귀 · 눈), 둘러보기가 모름. */}
        <div className="mt-10 grid w-full max-w-md grid-cols-2 gap-2.5">
          <Link
            href="/downloads"
            className="flex items-center justify-center whitespace-nowrap rounded-lg border border-ink px-3 py-3.5 text-sm font-medium text-ink transition hover:bg-subtle"
          >
            J-POP 단어 묶음 둘러보기
          </Link>
          <Link
            href="/login?next=%2Fword-books"
            className="group relative flex items-center justify-center whitespace-nowrap rounded-lg border border-ink bg-ink px-3 py-3.5 text-sm font-medium text-cream transition hover:bg-ink/85"
          >
            <svg
              viewBox="0 0 40 14"
              aria-hidden
              className="absolute -top-3 right-3 h-3.5 w-10 fill-ink transition group-hover:fill-ink/85"
            >
              <path d="M1.5 14 C2.6 8.5 4 4 6.2 0 C8.6 4.2 10.8 9 13 14 Z" />
              <path d="M27 14 C29.2 9 31.4 4.2 33.8 0 C36 4 37.4 8.5 38.5 14 Z" />
            </svg>
            <span
              aria-hidden
              className="absolute right-10 top-2 flex size-2 items-center justify-center"
            >
              <span className="h-[2px] w-2 rounded-full bg-cream transition-all duration-200 group-hover:h-2 group-hover:w-[2px]" />
            </span>
            <span
              aria-hidden
              className="absolute right-[22px] top-2 flex size-2 items-center justify-center"
            >
              <span className="h-[2px] w-2 rounded-full bg-cream transition-all duration-200 group-hover:h-2 group-hover:w-[2px]" />
            </span>
            로그인
          </Link>
        </div>
      </section>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/nyaki_normal.webp"
        alt="Nyaki"
        width={1792}
        height={2400}
        loading="lazy"
        className="mx-auto mt-16 block h-auto w-[min(340px,80%)]"
      />

      <section className="mt-12 grid gap-4 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="rounded-lg border border-taupe/60 px-5 py-5"
          >
            <h2 className="text-sm font-semibold text-ink">{feature.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/55">
              {feature.body}
            </p>
          </div>
        ))}
      </section>

      <p className="mt-12 flex flex-wrap items-center justify-center gap-2 text-center text-sm text-ink/55">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/churu.png" alt="" width={20} height={20} className="size-5" />
        매일 출석하면 츄르가 쌓인다냥. 오늘 외울 단어부터 넣어보자냥!
      </p>

      {/* <PricingSection /> 플랜 섹션 일단 주석처리 */}
    </main>
  );
}
