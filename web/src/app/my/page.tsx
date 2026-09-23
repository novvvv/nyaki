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
  const [learningText, setLearningText] = useState("");
  const [relearningText, setRelearningText] = useState("");
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
    setLearningText(value.learningSteps.join(" "));
    setRelearningText(value.relearningSteps.join(" "));
    setGraduatingText(String(value.graduatingIntervalDays));
  }

  const dirty =
    progress !== undefined &&
    (newText !== String(progress.dailyNewLimit) ||
      reviewText !== String(progress.dailyReviewLimit) ||
      learningText !== progress.learningSteps.join(" ") ||
      relearningText !== progress.relearningSteps.join(" ") ||
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
        learningSteps: learningText,
        relearningSteps: relearningText,
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
          label="학습 단계"
          value="새 단어를 이 간격(분)으로 다시 보여줍니다. 비우면 바로 다음 날로 넘어갑니다"
          action={
            <TextInput
              value={learningText}
              onChange={(e) => setLearningText(e.target.value)}
              placeholder="1 10"
              aria-label="학습 단계(분)"
              className="w-28 text-right"
            />
          }
        />
        <Row
          label="재학습 단계"
          value="외웠던 단어를 틀렸을 때의 간격(분)"
          action={
            <TextInput
              value={relearningText}
              onChange={(e) => setRelearningText(e.target.value)}
              placeholder="10"
              aria-label="재학습 단계(분)"
              className="w-28 text-right"
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
