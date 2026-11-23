"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/components/auth-provider";
import { InstallButton } from "@/components/install-button";
import { pictureWords, WordCard } from "@/components/word-card";
import { useAppMode } from "@/lib/app-mode";
import { useNyakiImage } from "@/lib/nyaki-skin";
import { getPack } from "@/lib/packs";
import { PLANS } from "@/lib/pricing-plans";
import { cn } from "@/lib/utils";

// import { PricingSection } from "@/components/pricing-section"; // 플랜 섹션 일단 주석처리

/** 형광펜 밑줄 — 글자 아래쪽 절반에만 칠한다. 다크모드에서는 더 옅게. */
function Mark({ children }: { children: ReactNode }) {
  return (
    <mark className="bg-transparent bg-[linear-gradient(transparent_58%,var(--marker)_58%)] px-0.5 text-ink [--marker:#efd6d6] dark:[--marker:rgba(239,214,214,0.3)]">
      {children}
    </mark>
  );
}

/** 이미지 연상 — 그림 한 장이 단어 하나로 이어진다. */
function PictureToWord() {
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/cards/N5_1_aki.webp"
        alt=""
        width={720}
        height={793}
        loading="lazy"
        className="size-16 rounded-lg bg-white object-cover object-top ring-1 ring-black/10"
      />
      <div className="text-center">
        <p className="text-[10px] leading-none text-ink/45">あき</p>
        <p className="mt-1 text-3xl font-semibold leading-none text-ink">秋</p>
      </div>
    </div>
  );
}

/** 쇼츠 — 유튜브 재생 아이콘 하나. */
function ShortsIcon() {
  return (
    <svg viewBox="0 0 28 20" aria-hidden className="h-12 w-auto">
      <rect width="28" height="20" rx="6" fill="#ff0033" />
      <path d="M11 6v8l7-4z" fill="#fff" />
    </svg>
  );
}

/**
 * 망각곡선 — 복습 없이 떨어지는 점선과, 복습할 때마다 다시 올라가며 점점
 * 천천히 떨어지는 실선. 그림일 뿐 실제 계산값은 아니다.
 */
function ForgettingCurve() {
  const reviews = [30, 80, 150];
  return (
    <div className="w-full max-w-[260px]">
      <svg viewBox="0 0 240 60" aria-hidden className="h-14 w-full">
        <path
          d="M0 6 Q30 46 240 56"
          fill="none"
          stroke="currentColor"
          strokeDasharray="3 4"
          className="text-ink/30"
        />
        <path
          d="M0 6 Q12 28 30 32 L30 6 Q55 24 80 28 L80 6 Q115 20 150 24 L150 6 Q195 16 240 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          className="text-ink"
        />
        {reviews.map((x) => (
          <circle key={x} cx={x} cy={6} r={3.5} fill="#f59e0b" />
        ))}
      </svg>
      <div className="mt-1.5 flex gap-3 text-[10px] text-ink/50">
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-[#f59e0b]" />
          복습할수록 오래 기억
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 border-t border-dashed border-ink/40" />
          복습 안 하면
        </span>
      </div>
    </div>
  );
}

/** 내 단어장 — 어디서 왔든 같은 단어장에 담긴다. */
function CustomChips() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {["애니 대사", "J-POP 가사", "자주 틀리는 단어"].map((label) => (
        <span
          key={label}
          className="rounded-full border border-taupe/60 px-2.5 py-1 text-[11px] text-ink/70"
        >
          {label}
        </span>
      ))}
      <span className="rounded-full border border-dashed border-ink/40 px-2.5 py-1 text-[11px] text-ink/55">
        + 직접 추가
      </span>
    </div>
  );
}

// 그림 단어장(준비 중)과 지금 쓸 수 있는 복습 · 내 단어장을 함께 소개한다.
const FEATURES: { title: string; visual: ReactNode; body: ReactNode }[] = [
  {
    title: "그림 한 장, 단어 하나 — 이미지 연상 학습",
    visual: <PictureToWord />,
    body: (
      <>
        글자 뜻만 빽빽하게 외우면 금방 잊어버리잖아요. 시각 정보와 단어를 함께
        기억하는 이미지 연상법으로,{" "}
        <Mark>뜻을 떠올리기 전에 장면부터 먼저 생각나게</Mark> 만들었어요.
      </>
    ),
  },
  {
    title: "쇼츠로 가볍게, 복습은 꼼꼼하게",
    visual: <ShortsIcon />,
    body: (
      <>
        쇼츠에서 스치듯 본 단어들, <Mark>냐키 단어장에 쏙 담아두고</Mark> 제대로
        내 것으로 만들어 보세요.
      </>
    ),
  },
  {
    title: "망각곡선을 이기는 SM-2 간격 반복 알고리즘",
    visual: <ForgettingCurve />,
    body: (
      <>
        ‘모름 / 외움’만 콕콕 눌러주세요. 검증된 SM-2 알고리즘이 내 기억력을
        계산해서, <Mark>머릿속에서 지워지기 직전 가장 완벽한 타이밍</Mark>에
        냐키가 다시 꺼내 보여줄게요.
      </>
    ),
  },
  {
    title: "내 마음대로 채우는 나만의 커스텀 단어장",
    visual: <CustomChips />,
    body: (
      <>
        기본 단어장만으로는 아쉽잖아요. 애니에서 들은 대사, J-POP 가사, 내가
        자주 틀리는 단어까지 직접 추가해서 나만의 단어장을 만들고,{" "}
        <Mark>똑같이 SM-2 알고리즘으로 관리</Mark>할 수 있어요.
      </>
    ),
  },
];

/** 랜딩에 펼쳐 보이는 카드 — N5 그림 단어 팩의 카드들. */
const SAMPLE_CARDS = pictureWords(getPack("jlpt-n5-picture")?.words ?? []);

/** 카드마다 부채꼴 자리 — 왼쪽 · 가운데 · 오른쪽. 마우스를 올리면 조금 더 벌어진다. */
const FAN = [
  "-translate-x-[135%] translate-y-4 rotate-[-10deg] group-hover:-translate-x-[150%] group-hover:rotate-[-13deg]",
  "-translate-x-1/2 -translate-y-1 group-hover:-translate-y-3",
  "translate-x-[35%] translate-y-4 rotate-[10deg] group-hover:translate-x-1/2 group-hover:rotate-[13deg]",
];

/** 겹쳐 펼친 카드 팩. */
function CardDeck() {
  const base =
    "absolute left-1/2 top-6 transition-transform duration-300 ease-out";
  return (
    <div className="group relative mx-auto h-[300px] w-full max-w-xl sm:h-[420px]">
      {SAMPLE_CARDS.slice(0, FAN.length).map((word, index) => (
        <WordCard
          key={word.term}
          word={word}
          no={index + 1}
          className={cn(base, "w-[136px] sm:w-[200px]", FAN[index])}
        />
      ))}
    </div>
  );
}

/**
 * 로그인한 사람의 메인 — 냐키와, 그 옆에 폰 크기로 띄운 이 사이트(앱 화면).
 * 같은 주소라 로그인 · 단어장이 그대로 보이고 눌러서 쓸 수 있다. 설치한 앱도
 * 바로 이 화면이다.
 *
 * 좁은 화면에서는 폰을 빼고 다운로드 버튼만 둔다 — 폰 안에 폰을 넣지 않는다.
 * 그래서 폰 안의 메인(좁은 폭)은 다시 폰을 그리지 않는다.
 */
/** 메인의 요금제 — 가격만 짧게, 자세한 건 /pricing. */
function PlansTeaser() {
  return (
    <section className="mt-20">
      <div className="flex flex-col items-center text-center">
        <span className="rounded-full border border-taupe/60 px-2.5 py-0.5 text-[11px] font-medium text-ink/55">
          준비 중
        </span>
        <h2 className="mt-3 text-lg font-semibold text-ink sm:text-xl">
          요금제
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink/55">
          기본 기능은 무료예요. 유료 플랜은 준비 중이고, 가격은 바뀔 수 있어요.
        </p>
      </div>
      <ul className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <li
            key={plan.id}
            className={cn(
              "rounded-2xl border px-4 py-4 text-center",
              plan.highlight ? "border-ink/80" : "border-taupe/60",
            )}
          >
            <p className="text-sm font-semibold text-ink">{plan.name}</p>
            <p className="mt-1 text-ink">
              <span className="text-xl font-bold tabular-nums">
                {plan.price}
              </span>
              {plan.per ? (
                <span className="ml-0.5 text-xs text-ink/45">{plan.per}</span>
              ) : null}
            </p>
            <p className="mt-1 text-xs text-ink/45">{plan.summary}</p>
          </li>
        ))}
      </ul>
      <div className="mt-6 text-center">
        <Link
          href="/pricing"
          className="inline-flex rounded-full border border-ink px-4 py-2 text-sm font-medium text-ink transition hover:bg-subtle"
        >
          요금제 자세히 보기
        </Link>
      </div>
    </section>
  );
}

function CatOnly() {
  const nyaki = useNyakiImage();
  return (
    <main className="flex min-h-[calc(100vh-8.5rem)] flex-col items-center justify-center gap-10 px-6 py-16 md:flex-row md:gap-16">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={nyaki("normal")}
        alt="Nyaki 고양이"
        width={1792}
        height={2400}
        className="block h-auto w-[min(380px,80vw)]"
      />
      <div className="flex flex-col items-center gap-5">
        <div className="hidden overflow-hidden rounded-[44px] border-[10px] border-ink shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)] md:block">
          <iframe
            src="/today"
            title="Nyaki 앱 화면"
            className="block h-[min(720px,calc(100vh-14rem))] w-[360px] bg-cream"
            style={{ border: 0 }}
          />
        </div>
        <InstallButton />
        <Link
          href="/pricing"
          className="text-sm text-ink/50 underline-offset-4 transition hover:text-ink hover:underline"
        >
          요금제 보기
        </Link>
      </div>
    </main>
  );
}

/** 메인. 로그인 안 한 사람에게는 냐키가 무엇인지 알려주는 짧은 랜딩을 보여준다. */
export default function HomePage() {
  const { ready, user } = useAuth();
  const appMode = useAppMode();
  const router = useRouter();
  const nyaki = useNyakiImage();
  // 앱에서는 메인(소개 · 미리보기) 대신 오늘 화면이 첫 화면이다.
  useEffect(() => {
    if (appMode && user) router.replace("/today");
  }, [appMode, user, router]);
  // 로그인 상태를 확인하는 동안에도 고양이만 — 로그인한 사람에게 랜딩이 번쩍이지 않게.
  if (!ready || user) return <CatOnly />;

  return (
    <main className="mx-auto w-full max-w-4xl break-keep px-6 py-16 sm:py-20">
      {/* 첫 화면 — 왼쪽 소개, 오른쪽 냐키. 좁은 화면에서는 냐키가 아래로. */}
      <section className="flex flex-col items-center gap-10 pt-4 text-center sm:flex-row sm:justify-between sm:gap-8 sm:text-left">
        <div className="flex flex-col items-center sm:items-start">
          <h1 className="text-2xl font-semibold leading-snug tracking-tight text-ink sm:text-3xl">
            이미지 연상과 간격 반복으로 완성하는
            <br />
            JLPT N5 · N4 단어장
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-ink/55 sm:text-base">
            뇌과학이 증명한 두 가지 암기법,
            <br className="sm:hidden" /> 냐키가 제일 편하게 떠먹여 줄게요.
          </p>
          {/* 복습 화면의 외움 · 모름 버튼과 같은 모양. 로그인이 외움(귀 · 눈), 카드 보기가 모름. */}
          <div className="mt-10 grid w-full max-w-md grid-cols-2 gap-2.5">
            <a
              href="#cards"
              className="flex items-center justify-center whitespace-nowrap rounded-lg border border-ink px-3 py-3.5 text-sm font-medium text-ink transition hover:bg-subtle"
            >
              단어 카드 미리보기
            </a>
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
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={nyaki("normal")}
          alt="Nyaki"
          width={1792}
          height={2400}
          className="block h-auto w-[min(300px,70vw)] shrink-0 sm:w-[280px]"
        />
      </section>

      <section id="cards" className="mt-24 scroll-mt-24">
        <div className="flex flex-col items-center text-center">
          <span className="rounded-full border border-taupe/60 px-2.5 py-0.5 text-[11px] font-medium text-ink/55">
            준비 중
          </span>
          <h2 className="mt-3 text-lg font-semibold text-ink sm:text-xl">
            JLPT N5 · N4 그림 단어장
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/55">
            유튜브 쇼츠에서 하루 한 장씩 먼저 공개하고,
            <br className="sm:hidden" /> 차곡차곡 모아서 단어장으로 올릴
            예정이에요.
          </p>
        </div>
        <div className="mt-8">
          <CardDeck />
        </div>
      </section>

      <section className="mt-20 grid gap-4 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="rounded-lg border border-taupe/60 px-5 py-5"
          >
            <div className="mb-4 flex h-20 items-center">{feature.visual}</div>
            <h2 className="text-sm font-semibold text-ink">{feature.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/55">
              {feature.body}
            </p>
          </div>
        ))}
      </section>

      <PlansTeaser />
    </main>
  );
}
