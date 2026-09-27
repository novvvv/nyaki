"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { ClozeEditor } from "@/components/cloze-editor";
import { PageHeader, PrimaryButton, SubtleButton } from "@/components/ui";
import { WordForm } from "@/components/word-form";
import { putClozeNote } from "@/lib/api-client";
import { countBlanks } from "@/lib/cloze";
import { cn } from "@/lib/utils";
import { useVocab } from "@/lib/vocab-store";
import { newId } from "@/lib/utils";

/**
 * 외울 거리 하나 추가.
 *
 * 저장은 단어와 빈칸 노트로 나뉘지만 **사용자에게는 같은 일**이다 — 화면을
 * 둘로 갈라두면 저장 구조가 그대로 드러난다. 여기서 종류만 고르게 한다.
 */
type Kind = "word" | "cloze";

const EXAMPLE = "TCP는 {{c1::연결 지향}}, UDP는 {{c2::비연결}} 프로토콜이다";

const KIND_KEY = "nyaki.item.kind";

/** 마지막으로 고른 종류. 브라우저에만 남는 편의값이라 실패는 무시한다. */
function loadKind(): Kind {
  try {
    return window.localStorage.getItem(KIND_KEY) === "cloze" ? "cloze" : "word";
  } catch {
    return "word";
  }
}

function saveKind(kind: Kind) {
  try {
    window.localStorage.setItem(KIND_KEY, kind);
  } catch {
    // 사생활 보호 모드 등에서 막힐 수 있다. 기억 못 해도 동작에는 지장 없다.
  }
}

export default function NewItemPage() {
  // 초기값으로 읽는다 — 이펙트에서 setState하면 렌더가 두 번 돌고,
  // 그 사이 "단어"가 잠깐 켜진 채로 보인다.
  const [kind, setKind] = useState<Kind>(loadKind);

  return (
    <>
      <div
        className={cn(
          "mx-auto w-full px-8 pt-14 lg:px-12",
          kind === "cloze" ? "max-w-5xl" : "max-w-3xl",
        )}
      >
        <div className="flex items-center gap-1.5">
          {(
            [
              ["word", "단어"],
              ["cloze", "빈칸"],
            ] as const
          ).map(([value, label]) => (
            <SubtleButton
              key={value}
              aria-pressed={kind === value}
              onClick={() => {
                setKind(value);
                saveKind(value);
              }}
              className={cn(
                "px-3.5 py-1.5 text-xs",
                kind === value && "border-ink bg-ink text-cream hover:text-cream",
              )}
            >
              {label}
            </SubtleButton>
          ))}
        </div>
      </div>

      {kind === "word" ? <WordForm mode="create" /> : <ClozeForm />}
    </>
  );
}

function ClozeForm() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();
  const { syncSummaries } = useVocab();

  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  // 노트 하나가 카드 한 장이다 — 이 수는 카드 수가 아니라 가려질 자리의 수다.
  const blanks = countBlanks(text);

  async function save() {
    if (saving || blanks === 0) return;
    setSaving(true);
    setError(undefined);
    try {
      const token = await getToken();
      if (!token) throw new Error("로그인이 필요합니다.");
      await putClozeNote(token, params.id, newId("cloze"), text);
      // 목록의 개수·암기율은 서버가 센다 — 추가한 뒤 다시 받아야 맞는다.
      await syncSummaries();
      router.push(`/word-books/${params.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "저장하지 못했어요.");
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-8 py-10 lg:px-12">
      <PageHeader
        title="빈칸"
        description="가릴 부분을 끌어서 고르고 빈칸을 누릅니다. 빈칸이 여럿이어도 한 번에 묻습니다."
      />

      <ClozeEditor value={text} onChange={setText} placeholder={EXAMPLE} />

      {error ? <p className="mt-6 text-sm text-red-700">{error}</p> : null}

      <div className="mt-8 flex items-center justify-end gap-3">
        <SubtleButton
          className="py-1.5 text-xs"
          onClick={() => router.push(`/word-books/${params.id}`)}
        >
          취소
        </SubtleButton>
        <PrimaryButton
          disabled={saving || blanks === 0}
          onClick={() => void save()}
        >
          {saving ? "저장 중…" : "저장"}
        </PrimaryButton>
      </div>
    </main>
  );
}
