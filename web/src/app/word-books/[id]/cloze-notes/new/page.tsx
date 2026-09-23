"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { PageHeader, PrimaryButton, SubtleButton, TextArea } from "@/components/ui";
import { putClozeNote } from "@/lib/api-client";
import { newId } from "@/lib/utils";

const EXAMPLE = "TCP는 {{c1::연결 지향}}, UDP는 {{c2::비연결}} 프로토콜이다";

/**
 * 빈칸 노트 작성.
 *
 * 단어 추가 화면과 따로 두는 이유는 입력 자체가 다르기 때문이다 —
 * 단어는 단어·뜻·예문 여러 칸이고, 빈칸 노트는 문장 한 덩이다.
 */
export default function NewClozeNotePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();

  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  // 서버와 같은 규칙으로 센다. 저장 전에 카드가 몇 장 생기는지 보여주려는 것뿐이다.
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
      setError(
        reason instanceof Error ? reason.message : "저장하지 못했어요.",
      );
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-8 py-14 lg:px-12">
      <PageHeader
        title="빈칸 노트"
        description="문장에 빈칸을 찍으면 빈칸마다 카드가 한 장씩 생깁니다."
      />

      <TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={EXAMPLE}
        rows={6}
        aria-label="빈칸 노트 문장"
        className="w-full text-base"
      />

      <div className="mt-3 rounded-lg bg-subtle/60 px-4 py-3.5 text-xs text-umber/55">
        <p className="font-medium text-ink/55">쓰는 법</p>
        <p className="mt-2">
          가릴 부분을 <code className="text-ink/70">{"{{c1::답}}"}</code> 으로
          감쌉니다. 번호를 늘리면 카드가 늘어납니다.
        </p>
        <p className="mt-1.5">
          <code className="text-ink/70">{"{{c1::답::힌트}}"}</code> 처럼 힌트를
          붙이면 빈칸 자리에 힌트가 보입니다.
        </p>
        <p className="mt-2 text-ink/45">예시 · {EXAMPLE}</p>
      </div>

      {error ? <p className="mt-6 text-sm text-red-700">{error}</p> : null}

      <div className="mt-8 flex items-center justify-end gap-3">
        <span className="text-xs text-umber/45">
          {blanks.size === 0
            ? "빈칸을 하나 이상 넣어 주세요"
            : `카드 ${blanks.size}장이 생깁니다`}
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
