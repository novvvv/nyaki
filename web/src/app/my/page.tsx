"use client";

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
import { loadShowDelays, saveShowDelays } from "@/lib/review";
import { cn } from "@/lib/utils";
import { bookMeta, useVocab } from "@/lib/vocab-store";

/**
 * 다음 복습 시각을 보여줄지.
 *
 * 저장 버튼이 없다 — 서버가 아니라 이 브라우저에만 남는 화면 설정이라 누르는
 * 즉시 반영된다. 기본은 꺼짐이다.
 */
function DelayHintToggle() {
  // 초기값으로 읽는다 — 이펙트에서 읽으면 꺼짐이 한 프레임 보인다.
  const [on, setOn] = useState(loadShowDelays);

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

/** 설정 한 덩어리 — 제목·한 줄 설명 위, 입력 아래. */
function Field({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-5">
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
    <section className="mb-12">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-ink/35">
        학습
      </p>
      <div className="divide-y divide-taupe/25">
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
              className="w-24 text-right tabular-nums"
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
              className="w-24 text-right tabular-nums"
            />
          }
        />
      </div>

      <p className="mb-1 mt-8 text-[11px] font-medium uppercase tracking-wider text-ink/35">
        복습 흐름
      </p>
      <div className="divide-y divide-taupe/25">
        <Field
          title="다음 복습 시각 표시"
          hint="채점 버튼 위에 즉시 · 10분처럼 띄웁니다"
        >
          <DelayHintToggle />
        </Field>
      </div>

      <div className="mt-4 flex items-center justify-end gap-3">
        {message ? (
          <p className="text-xs text-umber/45">{message}</p>
        ) : null}
        <SubtleButton
          className="py-1.5 text-xs"
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

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="단어장" value={`${wordBooks.length}`} />
        <Stat label="모은 단어" value={`${wordCount}`} />
        {/* 재화 — 하루 한도와 같은 /v1/progress 응답이다. 받기 전에는 — */}
        <Stat
          label="츄르"
          icon="/churu.png"
          value={progress ? `${progress.churuBalance}` : "—"}
        />
        <Stat
          label="열빙어"
          icon="/capelin.png"
          value={progress ? `${progress.capelinBalance}` : "—"}
        />
      </div>

      <div className="mb-12">
        {progress?.attendance ? (
          <CheckIn progress={progress} onChange={setProgress} />
        ) : null}
      </div>

      <DailyLimits onProgress={setProgress} />

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
