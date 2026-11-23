import Link from "next/link";

import { useNyakiImage } from "@/lib/nyaki-skin";
import { cn } from "@/lib/utils";

/** 이번 주 하루 — 월요일부터 일요일까지. */
export interface WeekDay {
  /** YYYY-MM-DD(로컬) */
  date: string;
  /** 월 · 화 · … */
  weekday: string;
  /** 며칠인지(숫자만) */
  day: number;
  /** 그날 넘긴 카드 수 */
  reviews: number;
  isToday: boolean;
  isFuture: boolean;
}

export interface TodayBook {
  id: string;
  title: string;
  /** 단어 + 빈칸 노트 */
  items: number;
  /** 암기율(%) */
  mastery: number;
  /** 오늘 복습할 카드 */
  due: number;
}

export interface TodayViewProps {
  /** 오늘 날짜 문구 — "11월 23일 일요일" */
  dateLabel: string;
  /** 오늘 복습할 카드. 받는 중이면 null */
  due: number | null;
  week: WeekDay[];
  /** 연속 출석 일수. 모르면 null(출석 칸을 숨긴다) */
  streak: number | null;
  checkedIn: boolean;
  checkingIn: boolean;
  onCheckIn: () => void;
  books: TodayBook[];
  /** 단어장을 받는 중 */
  booksLoading: boolean;
}

/** 이번 주 기록 — 공부한 날은 분홍으로 채우고, 오늘은 굵은 테두리. */
function WeekStrip({ week }: { week: WeekDay[] }) {
  const studied = week.filter((day) => day.reviews > 0).length;
  return (
    <section aria-label="이번 주 기록">
      <div className="grid grid-cols-7 gap-1.5">
        {week.map((day) => (
          <div key={day.date} className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                "text-[11px]",
                day.isToday ? "font-semibold text-ink" : "text-ink/40",
              )}
            >
              {day.weekday}
            </span>
            <span
              title={day.reviews > 0 ? `${day.reviews}장 복습` : undefined}
              className={cn(
                "grid size-9 place-items-center rounded-full text-[13px] tabular-nums",
                day.isFuture
                  ? "border border-dashed border-ink/15 text-ink/25"
                  : day.reviews > 0
                    ? "border border-ink/80 bg-[#efd6d6] font-semibold text-ink dark:bg-[#efd6d6]/30"
                    : "border border-ink/15 text-ink/45",
                day.isToday &&
                  "ring-2 ring-ink ring-offset-2 ring-offset-cream",
              )}
            >
              {day.reviews > 0 ? (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              ) : (
                day.day
              )}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-ink/45">
        이번 주 <b className="font-semibold text-ink">{studied}일</b> 복습했어요
      </p>
    </section>
  );
}

/** 오늘 할 일 — 분홍 카드에 냐키가 서 있다. 다 하면 웃는 냐키로 바뀐다. */
function DueCard({ due }: { due: number | null }) {
  const done = due === 0;
  const nyaki = useNyakiImage();
  return (
    <section className="relative overflow-hidden rounded-3xl border border-ink/80 bg-[#f7e9e9] dark:bg-[#efd6d6]/15">
      <div className="relative z-10 flex min-h-[188px] flex-col justify-between p-5 pr-[44%]">
        <div>
          <p className="text-xs font-medium text-ink/55">오늘 복습</p>
          <p className="mt-1 text-[34px] font-bold leading-none tracking-tight text-ink tabular-nums">
            {due === null ? "–" : done ? "끝!" : due}
            {due !== null && !done ? (
              <span className="ml-1 text-base font-semibold">장</span>
            ) : null}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink/55">
            {done
              ? "오늘 볼 카드를 다 봤어요. 새 단어를 담아 보세요."
              : "잊어버리기 직전인 카드부터 보여 드려요."}
          </p>
        </div>
        <Link
          href={done ? "/word-books" : "/review"}
          className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream transition hover:bg-ink/85"
        >
          {done ? "단어장 가기" : "테스트 시작"}
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={nyaki(done ? "happy" : "fighting")}
        alt=""
        width={900}
        height={1206}
        className="pointer-events-none absolute -bottom-10 -right-3 w-[48%] max-w-[190px]"
      />
    </section>
  );
}

/** 출석 — 하루 한 번. 연속 일수를 보여 준다. */
function StreakTile({
  streak,
  checkedIn,
  checkingIn,
  onCheckIn,
}: {
  streak: number;
  checkedIn: boolean;
  checkingIn: boolean;
  onCheckIn: () => void;
}) {
  return (
    <section className="flex items-center gap-3 rounded-2xl border border-taupe/70 px-4 py-3.5">
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-full bg-[#efd6d6] text-ink dark:bg-[#efd6d6]/30"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" />
          <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
          <path d="m9 14.8 2 2 4-4" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">
          {streak > 0 ? `${streak}일 연속 출석` : "오늘 첫 출석"}
        </p>
        <p className="text-xs text-ink/45">
          {checkedIn ? "오늘 출석했어요" : "하루 한 번 눌러 주세요"}
        </p>
      </div>
      <button
        type="button"
        onClick={onCheckIn}
        disabled={checkedIn || checkingIn}
        className={cn(
          "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition",
          checkedIn
            ? "border border-taupe text-ink/40"
            : "bg-ink text-cream hover:bg-ink/85 disabled:opacity-60",
        )}
      >
        {checkedIn ? "완료" : checkingIn ? "출석 중…" : "출석하기"}
      </button>
    </section>
  );
}

/** 단어장 타일 — 오늘 화면과 앱의 단어장 화면이 같이 쓴다. */
export function BookTile({ book }: { book: TodayBook }) {
  return (
    <Link
      href={`/word-books/${book.id}`}
      className="flex min-h-[124px] flex-col rounded-2xl border border-taupe/70 p-3.5 transition hover:border-ink/40"
    >
      <div className="flex items-start justify-between gap-2">
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="size-5 shrink-0 text-ink/70"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinejoin="round"
        >
          <path d="M5 4.5h11a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z" />
          <path d="M5 17a3 3 0 0 1 3-3h11" />
        </svg>
        {book.due > 0 ? (
          <span className="rounded-full bg-[#efd6d6] px-2 py-0.5 text-[10px] font-semibold text-ink tabular-nums dark:bg-[#efd6d6]/30">
            복습 {book.due}
          </span>
        ) : null}
      </div>
      <p className="mt-2.5 line-clamp-2 text-sm font-semibold leading-snug text-ink">
        {book.title}
      </p>
      <div className="mt-auto pt-3">
        <div className="flex items-baseline justify-between text-[11px] text-ink/45 tabular-nums">
          <span>{book.items}개</span>
          <span>{book.mastery}%</span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full rounded-full bg-ink"
            style={{ width: `${Math.min(100, Math.max(0, book.mastery))}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

/** 단어 다운로드 — 앱 탭 바에 없어서 오늘 화면에서 들어간다. */
function PackBanner() {
  const nyaki = useNyakiImage();
  return (
    <Link
      href="/downloads"
      className="flex items-center gap-3.5 rounded-2xl border border-taupe/70 p-3 transition hover:border-ink/40"
    >
      <div className="relative h-16 w-[52px] shrink-0 overflow-hidden rounded-lg bg-[linear-gradient(160deg,#f7e9e9_0%,#efd6d6_55%,#e6c3c3_100%)] ring-1 ring-black/10">
        <div aria-hidden className="h-1.5 bg-[#d9b4b4]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={nyaki("angry")}
          alt=""
          width={900}
          height={1206}
          className="absolute -bottom-3 left-1/2 w-[110%] -translate-x-1/2"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium tracking-wider text-ink/40">
          단어 다운로드
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-ink">
          JLPT N5 그림 단어 팩
        </p>
        <p className="text-xs text-ink/45">그림으로 외우는 N5 단어</p>
      </div>
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="size-4 shrink-0 text-ink/35"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

function SectionTitle({
  children,
  href,
}: {
  children: React.ReactNode;
  href?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-[15px] font-semibold text-ink">{children}</h2>
      {href ? (
        <Link
          href={href}
          className="text-xs text-ink/45 transition hover:text-ink"
        >
          전체 보기
        </Link>
      ) : null}
    </div>
  );
}

/**
 * 앱의 첫 화면 — 인사, 이번 주 기록, 오늘 복습, 출석, 단어장, 단어 다운로드.
 * 데이터는 받아 온 값만 그린다(app/today/page.tsx).
 */
export function TodayView({
  dateLabel,
  due,
  week,
  streak,
  checkedIn,
  checkingIn,
  onCheckIn,
  books,
  booksLoading,
}: TodayViewProps) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-7 px-5 pb-10 pt-6 break-keep">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-ink/45">{dateLabel}</p>
          <h1 className="mt-1 text-[22px] font-bold tracking-tight text-ink">
            안녕하세요!
          </h1>
        </div>
        <Link href="/my" aria-label="마이페이지" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt=""
            width={192}
            height={192}
            className="size-11 rounded-full ring-1 ring-ink/10"
          />
        </Link>
      </header>

      <WeekStrip week={week} />

      <div className="flex flex-col gap-3">
        <DueCard due={due} />
        {streak !== null ? (
          <StreakTile
            streak={streak}
            checkedIn={checkedIn}
            checkingIn={checkingIn}
            onCheckIn={onCheckIn}
          />
        ) : null}
      </div>

      <section>
        <SectionTitle href="/word-books">내 단어장</SectionTitle>
        {books.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {books.map((book) => (
              <BookTile key={book.id} book={book} />
            ))}
          </div>
        ) : (
          <Link
            href="/word-books/new"
            className="flex min-h-[96px] items-center justify-center rounded-2xl border border-dashed border-ink/20 text-sm text-ink/45 transition hover:border-ink/40 hover:text-ink"
          >
            {booksLoading ? "불러오는 중…" : "+ 첫 단어장 만들기"}
          </Link>
        )}
      </section>

      <section>
        <SectionTitle>새 단어</SectionTitle>
        <PackBanner />
      </section>
    </main>
  );
}
