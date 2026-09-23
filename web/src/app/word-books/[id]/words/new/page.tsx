"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth-provider";
import {
  PageHeader,
  PrimaryButton,
  SubtleButton,
  TextArea,
} from "@/components/ui";
import { WordForm } from "@/components/word-form";
import { putClozeNote } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { newId } from "@/lib/utils";

/**
 * 외울 거리 하나 추가.
 *
 * 저장은 단어와 빈칸 노트로 나뉘지만 **사용자에게는 같은 일**이다 — 화면을
 * 둘로 갈라두면 저장 구조가 그대로 드러난다. 여기서 종류만 고르게 한다.
 */
type Kind = "word" | "cloze";

const EXAMPLE = "TCP는 {{c1::연결 지향}}, UDP는 {{c2::비연결}} 프로토콜이다";

export default function NewItemPage() {
  const [kind, setKind] = useState<Kind>("word");

  return (
    <>
      <div className="mx-auto w-full max-w-3xl px-8 pt-14 lg:px-12">
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
              onClick={() => setKind(value)}
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

  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  // 서버와 같은 규칙으로 센다. 저장 전에 카드가 몇 장 생기는지만 보여준다.
  const blanks = new Set(
    [...text.matchAll(/\{\{c(\d+)::/g)].map((match) => match[1]),
  );

  async function save() {
    if (saving || blanks.size === 0) return;
    setSaving(true);
    setError(undefined);
    try {
      const token = await getToken();
      if (!token) throw new Error("로그인이 필요합니다.");
      await putClozeNote(token, params.id, newId("cloze"), text);
      router.push(`/word-books/${params.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "저장하지 못했어요.");
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-8 py-10 lg:px-12">
      <PageHeader
        title="빈칸"
        description="가릴 부분을 {{c1::답}} 으로 감쌉니다. 번호를 늘리면 카드가 늘어납니다."
      />

      <TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={EXAMPLE}
        rows={6}
        aria-label="빈칸 문장"
        className="w-full text-base"
      />

      {error ? <p className="mt-6 text-sm text-red-700">{error}</p> : null}

      <div className="mt-8 flex items-center justify-end gap-3">
        <span className="text-xs text-umber/45">
          {blanks.size === 0 ? "빈칸을 하나 이상" : `카드 ${blanks.size}장`}
        </span>
        <SubtleButton
          className="py-1.5 text-xs"
          onClick={() => router.push(`/word-books/${params.id}`)}
        >
          취소
        </SubtleButton>
        <PrimaryButton
          disabled={saving || blanks.size === 0}
          onClick={() => void save()}
        >
          {saving ? "저장 중…" : "저장"}
        </PrimaryButton>
      </div>
    </main>
  );
}
