"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { Card, PageHeader, SubtleButton, TextInput } from "@/components/ui";
import {
  checkIn,
  fetchProgress,
  updateSettings,
  type Progress,
} from "@/lib/api-client";
import {
  loadShowDelays,
  loadSkin,
  saveShowDelays,
  saveSkin,
  type ReviewSkin,
} from "@/lib/review";
import { useAppMode } from "@/lib/app-mode";
import { useNyakiImage } from "@/lib/nyaki-skin";
import { loadTheme, saveTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { bookMeta, useVocab } from "@/lib/vocab-store";

/** 앱의 켜고 끄기 스위치. */
function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full transition",
        on ? "bg-ink" : "bg-ink/15",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0.5 top-0.5 size-6 rounded-full bg-cream shadow-sm transition-transform",
          on && "translate-x-5",
        )}
      />
    </button>
  );
}

/** 앱의 고르기 — 알약 묶음. 웹은 테두리 버튼 줄(SubtleButton)이다. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex w-full gap-0.5 rounded-full bg-subtle p-1">
      {options.map((option) => {
        const on = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-full py-1.5 text-xs transition",
              on
                ? "bg-cream font-semibold text-ink shadow-sm"
                : "font-medium text-ink/45 hover:text-ink/70",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 다음 복습 시각을 보여줄지.
 *
 * 저장 버튼이 없다 — 서버가 아니라 이 브라우저에만 남는 화면 설정이라 누르는
 * 즉시 반영된다. 기본은 꺼짐이다.
 */
function DelayHintToggle() {
  // 초기값으로 읽는다 — 이펙트에서 읽으면 꺼짐이 한 프레임 보인다.
  const [on, setOn] = useState(loadShowDelays);
  const app = useAppMode();

  if (app) {
    return (
      <Switch
        on={on}
        onClick={() => {
          const next = !on;
          setOn(next);
          saveShowDelays(next);
        }}
      />
    );
  }

  return (
    <SubtleButton
      aria-pressed={on}
      onClick={() => {
        const next = !on;
        setOn(next);
        saveShowDelays(next);
      }}
      className={cn(
        "px-3.5 py-1.5 text-xs",
        on && "border-ink bg-ink text-cream hover:text-cream",
      )}
    >
      {on ? "켜짐" : "꺼짐"}
    </SubtleButton>
  );
}

const SKINS: { value: ReviewSkin; label: string }[] = [
  { value: "plain", label: "기본" },
  { value: "note", label: "노트" },
];

/**
 * 테스트 화면 스킨.
 *
 * 다음 복습 시각 표시와 같이 이 브라우저에만 남는 화면 설정이라 누르는 즉시
 * 반영된다. 기본은 지금의 흰 화면이다.
 */
function SkinPicker() {
  // 초기값으로 읽는다 — 이펙트에서 읽으면 기본이 한 프레임 보인다.
  const [skin, setSkin] = useState(loadSkin);
  const app = useAppMode();

  if (app) {
    return (
      <Segmented
        options={SKINS}
        value={skin}
        onChange={(value) => {
          setSkin(value);
          saveSkin(value);
        }}
      />
    );
  }

  return (
    <div className="flex gap-2">
      {SKINS.map((option) => {
        const on = skin === option.value;
        return (
          <SubtleButton
            key={option.value}
            aria-pressed={on}
            onClick={() => {
              setSkin(option.value);
              saveSkin(option.value);
            }}
            className={cn(
              "px-3.5 py-1.5 text-xs",
              on && "border-ink bg-ink text-cream hover:text-cream",
            )}
          >
            {option.label}
          </SubtleButton>
        );
      })}
    </div>
  );
}

const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "시스템" },
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
];

/**
 * 화면 테마. 스킨처럼 이 브라우저에만 남고 누르는 즉시 바뀐다.
 * 기본은 라이트. 시스템을 고르면 폰 · 컴퓨터가 다크일 때 다크다.
 */
function ThemePicker() {
  // 초기값으로 읽는다 — 이펙트에서 읽으면 시스템이 한 프레임 보인다.
  const [theme, setTheme] = useState(loadTheme);
  const app = useAppMode();

  if (app) {
    return (
      <Segmented
        options={THEMES}
        value={theme}
        onChange={(value) => {
          setTheme(value);
          saveTheme(value);
        }}
      />
    );
  }

  return (
    <div className="flex gap-2">
      {THEMES.map((option) => {
        const on = theme === option.value;
        return (
          <SubtleButton
            key={option.value}
            aria-pressed={on}
            onClick={() => {
              setTheme(option.value);
              saveTheme(option.value);
            }}
            className={cn(
              "px-3.5 py-1.5 text-xs",
              on && "border-ink bg-ink text-cream hover:text-cream",
            )}
          >
            {option.label}
          </SubtleButton>
        );
      })}
    </div>
  );
}

/**
 * 설정 묶음 — 작은 머리글 아래 줄들. 앱은 둥근 카드 하나에 담는다.
 */
function Group({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const app = useAppMode();
  return (
    <div className={className}>
      <p
        className={cn(
          "mb-1 text-[11px] font-medium uppercase tracking-wider text-ink/35",
          app && "mb-2 px-1 text-xs normal-case tracking-normal text-ink/50",
        )}
      >
        {label}
      </p>
      <div
        className={cn(
          "divide-y divide-taupe/25",
          app && "rounded-3xl border border-taupe/70 px-4 divide-taupe/40",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** 설정 한 덩어리 — 제목·한 줄 설명 위, 입력 아래. */
function Field({
  title,
  hint,
  inline = false,
  children,
}: {
  title: string;
  hint: string;
  /** 앱에서 입력을 오른쪽에 둔다(스위치처럼 작은 것). */
  inline?: boolean;
  children: React.ReactNode;
}) {
  const app = useAppMode();
  if (app && inline) return <Row label={title} value={hint} action={children} />;
  return (
    <div className={app ? "py-4" : "py-5"}>
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-0.5 text-xs text-umber/45">{hint}</p>
      <div className="mt-3.5">{children}</div>
    </div>
  );
}

/**
 * 하루 한도 — 안키의 "새 카드/일", "최대 복습량/일"에 해당한다.
 *
 * 값은 서버가 들고 있다. 이 숫자가 곧 출제량을 정하기 때문에 기기마다 다르면
 * 안 된다. 입력은 문자열로 들고 있다가 저장할 때만 숫자로 바꾼다 — 지우는
 * 도중(빈 문자열)에 0으로 튀는 걸 막는다.
 */
function DailyLimits({
  onProgress,
}: {
  /** 받은 진행도를 위로 올린다 — 같은 응답으로 재화 잔액도 보여준다. */
  onProgress: (value: Progress) => void;
}) {
  const { getToken } = useAuth();
  const [progress, setProgress] = useState<Progress>();
  const [newText, setNewText] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const app = useAppMode();

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const value = await fetchProgress(token);
    setProgress(value);
    onProgress(value);
    apply(value);
  }, [getToken, onProgress]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch {
        if (!cancelled) setMessage("설정을 불러오지 못했어요.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  function apply(value: Progress) {
    setNewText(String(value.dailyNewLimit));
    setReviewText(String(value.dailyReviewLimit));
  }

  const dirty =
    progress !== undefined &&
    (newText !== String(progress.dailyNewLimit) ||
      reviewText !== String(progress.dailyReviewLimit));

  async function save() {
    if (!progress || saving) return;
    setSaving(true);
    setMessage(undefined);
    try {
      const token = await getToken();
      if (!token) throw new Error("로그인이 필요합니다.");

      const clamp = (text: string, fallback: number) => {
        const n = Number.parseInt(text, 10);
        return Number.isNaN(n) ? fallback : Math.min(Math.max(n, 0), 9999);
      };

      const saved = await updateSettings(token, {
        dailyNewLimit: clamp(newText, progress.dailyNewLimit),
        dailyReviewLimit: clamp(reviewText, progress.dailyReviewLimit),
      });
      setProgress(saved);
      onProgress(saved);
      apply(saved);
      setMessage("저장했다냥");
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : "저장하지 못했어요.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={app ? "flex flex-col gap-6" : "mb-12"}>
      <Group label="학습">
        <Row
          label="하루에 새로 배울 단어"
          value="단어장마다 따로 적용됩니다. 9999면 제한 없음"
          action={
            <TextInput
              type="number"
              inputMode="numeric"
              min={0}
              max={9999}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              aria-label="하루에 새로 배울 단어 수"
              className={cn(
                "w-24 text-right tabular-nums",
                app && "w-20 rounded-xl",
              )}
            />
          }
        />
        <Row
          label="하루 복습 상한"
          value="밀린 복습이 너무 많을 때만 줄이세요. 9999면 제한 없음"
          action={
            <TextInput
              type="number"
              inputMode="numeric"
              min={0}
              max={9999}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              aria-label="하루 복습 상한"
              className={cn(
                "w-24 text-right tabular-nums",
                app && "w-20 rounded-xl",
              )}
            />
          }
        />
      </Group>

      <Group label="복습 흐름" className={app ? undefined : "mt-8"}>
        <Field
          title="다음 복습 시각 표시"
          hint="채점 버튼 위에 즉시 · 10분처럼 띄웁니다"
          inline
        >
          <DelayHintToggle />
        </Field>
        <Field
          title="테스트 화면"
          hint="노트를 고르면 문제가 줄 노트 위에 나옵니다"
        >
          <SkinPicker />
        </Field>
      </Group>

      <div
        className={cn(
          "mt-4 flex items-center justify-end gap-3",
          app && "mt-0",
          // 앱 — 고친 게 없으면 저장 줄을 숨긴다. 남은 안내 문구는 보인다.
          app && !dirty && !message && "hidden",
        )}
      >
        {message ? <p className="text-xs text-umber/45">{message}</p> : null}
        <SubtleButton
          className={cn(
            "py-1.5 text-xs",
            app && "rounded-full border-ink bg-ink px-5 py-2 text-cream hover:text-cream",
          )}
          disabled={!dirty || saving}
          onClick={() => void save()}
        >
          {saving ? "저장 중…" : "저장"}
        </SubtleButton>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  /** 숫자 왼쪽에 붙는 24px 이미지. 앱 홈의 재화 표시와 같은 모양이다. */
  icon?: string;
}) {
  return (
    <Card className="bg-card">
      {/* 이미지가 있으면 이름은 화면에서 감춘다 — 이미지가 곧 이름이다. 자리는
          남겨 옆 카드들과 숫자 높이를 맞추고, 화면 읽기에는 숫자 앞에서 읽힌다. */}
      <p
        className={cn("text-xs text-umber/45", icon && "invisible")}
        aria-hidden={icon ? true : undefined}
      >
        {label}
      </p>
      <p className="mt-1.5 flex items-center gap-1.5 text-2xl font-semibold tabular-nums tracking-tight text-ink">
        {icon ? (
          <>
            <span className="sr-only">{label}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={icon} alt="" width={24} height={24} className="size-6" />
          </>
        ) : null}
        {value}
      </p>
    </Card>
  );
}

/** "다음 출석까지 5시간 12분". 화면 표시용이라 기기 시계를 쓴다 — 판정은 서버가 한다. */
function untilLabel(nextResetAt: string, now: number): string {
  const minutes = Math.max(
    0,
    Math.ceil((new Date(nextResetAt).getTime() - now) / 60000),
  );
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}시간 ${minutes % 60}분` : `${minutes}분`;
}

/**
 * 출석 버튼. 하루 한 번 츄르 5개.
 *
 * "오늘"은 서버가 정한다(KST 자정). 화면은 서버가 준 다음 리셋 시각까지 남은
 * 시간만 보여주고, 그 시각이 지나면 진행도를 다시 받아 버튼을 되살린다 —
 * 자정을 넘겨 켜둔 화면이 "출석 완료"에 멈춰 있지 않게.
 */
function CheckIn({
  progress,
  onChange,
}: {
  progress: Progress;
  onChange: (value: Progress) => void;
}) {
  const { getToken } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
  const attendance = progress.attendance!;
  const app = useAppMode();

  // 남은 시간 표시를 1분마다 갱신한다.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // 다음 리셋 시각이 지나면 서버에 다시 묻는다.
  useEffect(() => {
    const wait = new Date(attendance.nextResetAt).getTime() - Date.now();
    const timer = window.setTimeout(
      () => {
        void (async () => {
          const token = await getToken();
          if (!token) return;
          try {
            onChange(await fetchProgress(token));
          } catch {
            // 다음에 화면을 열 때 다시 받는다.
          }
        })();
      },
      // 자정 직후 서버와 몇 초 어긋날 수 있어 조금 늦게 묻는다.
      Math.max(wait, 0) + 2_000,
    );
    return () => window.clearTimeout(timer);
  }, [attendance.nextResetAt, getToken, onChange]);

  async function handleCheckIn() {
    if (pending || attendance.checkedInToday) return;
    setPending(true);
    setError(undefined);
    try {
      const token = await getToken();
      if (!token) throw new Error("로그인이 필요합니다.");
      const result = await checkIn(token);
      onChange({
        ...progress,
        churuBalance: result.churuBalance,
        attendance: result.attendance,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "출석하지 못했어요.");
    } finally {
      setPending(false);
    }
  }

  if (app) {
    return (
      <section className="flex items-center gap-3 rounded-3xl border border-taupe/70 px-4 py-3.5">
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
            {attendance.streak > 0
              ? `${attendance.streak}일 연속 출석`
              : "오늘 첫 출석"}
          </p>
          <p className="text-xs tabular-nums text-ink/45">
            {error
              ? error
              : attendance.checkedInToday
                ? `다음 출석까지 ${untilLabel(attendance.nextResetAt, now)}`
                : "하루 한 번 눌러 주세요"}
          </p>
        </div>
        <button
          type="button"
          disabled={attendance.checkedInToday || pending}
          onClick={() => void handleCheckIn()}
          className={cn(
            "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition",
            attendance.checkedInToday
              ? "border border-taupe text-ink/40"
              : "bg-ink text-cream hover:bg-ink/85 disabled:opacity-60",
          )}
        >
          {attendance.checkedInToday
            ? "완료"
            : pending
              ? "출석 중…"
              : "출석하기"}
        </button>
      </section>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {attendance.checkedInToday ? (
        <p className="text-xs tabular-nums text-umber/45">
          다음 출석까지 {untilLabel(attendance.nextResetAt, now)}
        </p>
      ) : null}
      <SubtleButton
        className="py-1.5 text-xs"
        disabled={attendance.checkedInToday || pending}
        onClick={() => void handleCheckIn()}
      >
        {attendance.checkedInToday
          ? `출석 완료 · ${attendance.streak}일 연속`
          : pending
            ? "출석하는 중…"
            : "출석하기"}
      </SubtleButton>
    </div>
  );
}

function Row({
  label,
  value,
  action,
}: {
  label: string;
  value: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm text-ink">{label}</p>
        <p className="mt-0.5 truncate text-xs text-umber/45">{value}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** 앱의 프로필 카드 — 분홍 카드에 사진 · 이름, 아래 흰 칸에 숫자 셋. 냐키가 옆에 선다. */
function ProfileCard({
  name,
  email,
  photo,
  books,
  words,
  streak,
}: {
  name: string;
  email: string;
  photo?: string;
  books: number;
  words: number;
  /** 연속 출석. 아직 모르면 undefined */
  streak?: number;
}) {
  const nyaki = useNyakiImage();
  const stats = [
    { label: "단어장", value: books },
    { label: "모은 단어", value: words },
    { label: "연속 출석", value: streak, unit: "일" },
  ];
  return (
    <section className="relative overflow-hidden rounded-3xl border border-ink/80 bg-[#f7e9e9] p-4 dark:bg-[#efd6d6]/15">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={nyaki("normal")}
        alt=""
        width={900}
        height={1206}
        className="pointer-events-none absolute -right-4 -top-2 w-[38%] max-w-[150px]"
      />
      <div className="relative flex items-center gap-3 pr-[30%] pt-1">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cream text-lg font-semibold text-ink/40 ring-2 ring-cream">
          {photo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={photo} alt="" className="size-full object-cover" />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[17px] font-bold tracking-tight text-ink">
            {name}
          </p>
          <p className="mt-0.5 truncate text-xs text-ink/50">{email}</p>
        </div>
      </div>
      <dl className="relative mt-5 grid grid-cols-3 divide-x divide-ink/10 rounded-2xl border border-ink/10 bg-cream py-3 text-center">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="text-[11px] text-ink/45">{stat.label}</dt>
            <dd className="mt-0.5 text-lg font-bold tabular-nums text-ink">
              {stat.value ?? "–"}
              {stat.value !== undefined && stat.unit ? (
                <span className="ml-0.5 text-xs font-semibold">{stat.unit}</span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** 앱의 계정 줄 — 줄 전체가 버튼이고 오른쪽에 꺾쇠. */
function MenuRow({
  label,
  hint,
  danger = false,
  onClick,
}: {
  label: string;
  hint?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 py-3.5 text-left"
    >
      <span className="min-w-0">
        <span
          className={cn(
            "block text-sm",
            danger ? "text-red-600" : "text-ink",
          )}
        >
          {label}
        </span>
        {hint ? (
          <span className="mt-0.5 block text-xs text-umber/45">{hint}</span>
        ) : null}
      </span>
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="size-4 shrink-0 text-ink/30"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

export default function MyPage() {
  const router = useRouter();
  const { user, signOutUser } = useAuth();
  const { wordBooks } = useVocab();
  // 아래 하루 한도 칸이 받아온 진행도. 재화 잔액을 같이 보여준다.
  const [progress, setProgress] = useState<Progress>();

  const wordCount = wordBooks.reduce(
    (sum, book) => sum + bookMeta(book).count,
    0,
  );
  const appMode = useAppMode();

  if (appMode) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 pb-10 pt-5 break-keep">
        <ProfileCard
          name={user?.displayName ?? "이름 없음"}
          email={user?.email ?? "—"}
          photo={user?.photoURL ?? undefined}
          books={wordBooks.length}
          words={wordCount}
          streak={progress?.attendance?.streak}
        />
        {progress?.attendance ? (
          <CheckIn progress={progress} onChange={setProgress} />
        ) : null}
        <DailyLimits onProgress={setProgress} />
        <Group label="화면">
          <Field title="테마" hint="시스템을 고르면 폰 설정을 따라갑니다">
            <ThemePicker />
          </Field>
          <MenuRow
            label="상점"
            hint="냐키 옷 바꾸기"
            onClick={() => router.push("/shop")}
          />
        </Group>
        <Group label="계정">
          <MenuRow label="로그아웃" onClick={() => void signOutUser()} />
          <MenuRow
            label="회원 탈퇴"
            hint="모든 단어장이 삭제됩니다"
            danger
            onClick={() => router.push("/my/withdraw")}
          />
        </Group>
        {/* 앱에는 푸터가 없다 — 약관 · 방침으로 가는 길을 여기 둔다. */}
        <nav className="flex justify-center gap-4 pt-2 text-xs text-ink/40">
          <Link href="/terms" className="transition hover:text-ink">
            이용약관
          </Link>
          <Link href="/privacy" className="transition hover:text-ink">
            개인정보처리방침
          </Link>
          <a
            href="https://blog.naver.com/doidev"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-ink"
          >
            블로그
          </a>
        </nav>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-8 py-14 lg:px-12">
      <PageHeader title="마이페이지" />

      <div className="mb-10 flex items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-subtle text-lg font-semibold text-ink/40">
          {user?.photoURL ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={user.photoURL}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            (user?.displayName ?? user?.email ?? "?").charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {user?.displayName ?? "이름 없음"}
          </p>
          <p className="mt-0.5 truncate text-xs text-umber/45">
            {user?.email ?? "—"}
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <Stat label="단어장" value={`${wordBooks.length}`} />
        <Stat label="모은 단어" value={`${wordCount}`} />
      </div>

      <div className="mb-12">
        {progress?.attendance ? (
          <CheckIn progress={progress} onChange={setProgress} />
        ) : null}
      </div>

      <DailyLimits onProgress={setProgress} />

      <section className="mb-12">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-ink/35">
          화면
        </p>
        <div className="divide-y divide-taupe/25">
          <Field
            title="테마"
            hint="시스템을 고르면 폰 · 컴퓨터 설정을 따라갑니다"
          >
            <ThemePicker />
          </Field>
        </div>
      </section>

      <section>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-ink/35">
          계정
        </p>
        <div className="divide-y divide-taupe/25">
          <Row
            label="로그아웃"
            value="이 기기에서 로그아웃합니다"
            action={
              <SubtleButton
                className="py-1.5 text-xs"
                onClick={() => void signOutUser()}
              >
                로그아웃
              </SubtleButton>
            }
          />
          <Row
            label="회원 탈퇴"
            value="모든 단어장이 삭제됩니다"
            action={
              <SubtleButton
                className="py-1.5 text-xs"
                onClick={() => router.push("/my/withdraw")}
              >
                탈퇴
              </SubtleButton>
            }
          />
        </div>
      </section>
    </main>
  );
}
