"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { Card, PageHeader, SubtleButton, TextInput } from "@/components/ui";
import {
  fetchProgress,
  updateSettings,
  type Progress,
} from "@/lib/api-client";
import { bookMeta, useVocab } from "@/lib/vocab-store";

/** 칸 목록 → 서버가 받는 문자열. 빈 칸은 빠진다. */
function stepsToText(steps: string[]): string {
  return steps
    .map((step) => step.trim())
    .filter((step) => step.length > 0 && Number.parseInt(step, 10) > 0)
    .join(",");
}

/**
 * 단계 칸들. 개수가 가변이라 한 칸에 몰아 적는 대신 칸을 나눈다 —
 * "1 10"을 한 칸에 적으면 110처럼 읽힌다.
 *
 * 칸을 비우고 저장하면 그 단계가 빠지고, 전부 비우면 단계를 끈다.
 */
function StepFields({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {values.map((value, index) => (
        <TextInput
          key={index}
          type="number"
          inputMode="numeric"
          min={1}
          max={9999}
          value={value}
          onChange={(e) =>
            onChange(values.map((v, i) => (i === index ? e.target.value : v)))
          }
          aria-label={`${label} ${index + 1}번째 단계(분)`}
          className="w-16 px-2 text-right tabular-nums"
        />
      ))}
      <SubtleButton
        className="px-2.5 py-1.5 text-xs"
        onClick={() => onChange([...values, ""])}
        aria-label={`${label} 추가`}
      >
        +
      </SubtleButton>
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
function DailyLimits() {
  const { getToken } = useAuth();
  const [progress, setProgress] = useState<Progress>();
  const [newText, setNewText] = useState("");
  const [reviewText, setReviewText] = useState("");
  // 단계는 개수가 가변이라 칸을 배열로 들고 있는다. 저장할 때만 문자열로 합친다.
  const [learningSteps, setLearningSteps] = useState<string[]>([]);
  const [relearningSteps, setRelearningSteps] = useState<string[]>([]);
  const [graduatingText, setGraduatingText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const value = await fetchProgress(token);
    setProgress(value);
    apply(value);
  }, [getToken]);

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
    setLearningSteps(value.learningSteps.map(String));
    setRelearningSteps(value.relearningSteps.map(String));
    setGraduatingText(String(value.graduatingIntervalDays));
  }

  const dirty =
    progress !== undefined &&
    (newText !== String(progress.dailyNewLimit) ||
      reviewText !== String(progress.dailyReviewLimit) ||
      stepsToText(learningSteps) !== progress.learningSteps.join(",") ||
      stepsToText(relearningSteps) !== progress.relearningSteps.join(",") ||
      graduatingText !== String(progress.graduatingIntervalDays));

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
        learningSteps: stepsToText(learningSteps),
        relearningSteps: stepsToText(relearningSteps),
        graduatingIntervalDays: Math.max(
          1,
          clamp(graduatingText, progress.graduatingIntervalDays),
        ),
      });
      setProgress(saved);
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
          value="팩을 담아도 이 개수만큼만 새로 나옵니다"
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
          value="밀린 복습이 너무 많을 때만 줄이세요"
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
        <Row
          label="학습 단계 (분)"
          value="새 단어를 이 간격으로 다시 보여줍니다. 1 · 10이면 1분 뒤와 10분 뒤"
          action={
            <StepFields
              label="학습 단계"
              values={learningSteps}
              onChange={setLearningSteps}
            />
          }
        />
        <Row
          label="재학습 단계 (분)"
          value="외웠던 단어를 틀렸을 때의 간격. 칸을 비우고 저장하면 그 단계가 빠집니다"
          action={
            <StepFields
              label="재학습 단계"
              values={relearningSteps}
              onChange={setRelearningSteps}
            />
          }
        />
        <Row
          label="졸업 간격"
          value="마지막 단계를 통과하면 며칠 뒤에 볼지"
          action={
            <TextInput
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              value={graduatingText}
              onChange={(e) => setGraduatingText(e.target.value)}
              aria-label="졸업 간격(일)"
              className="w-28 text-right tabular-nums"
            />
          }
        />
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="bg-card">
      <p className="text-xs text-umber/45">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-ink">
        {value}
      </p>
    </Card>
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
  const { user, signOutUser } = useAuth();
  const { wordBooks } = useVocab();

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

      <div className="mb-12 grid gap-4 sm:grid-cols-2">
        <Stat label="단어장" value={`${wordBooks.length}`} />
        <Stat label="모은 단어" value={`${wordCount}`} />
      </div>

      <DailyLimits />

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
              <SubtleButton className="py-1.5 text-xs" disabled>
                탈퇴
              </SubtleButton>
            }
          />
        </div>
      </section>
    </main>
  );
}
