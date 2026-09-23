"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader, SubtleButton } from "@/components/ui";
import { CARD_KIND_LABELS, type CardKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useVocab } from "@/lib/vocab-store";

/**
 * 단어장 설정.
 *
 * 카드 종류는 매번 보는 값이 아니라 한 번 정해두는 값이라 목록 화면에서 뺐다.
 */
export default function WordBookSettingsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { getWordBook, updateWordBook } = useVocab();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const book = getWordBook(params.id);
  const kinds = book?.cardKinds ?? ["recognition"];

  async function toggle(kind: CardKind) {
    if (!book || saving) return;
    const next = kinds.includes(kind)
      ? kinds.filter((value) => value !== kind)
      : [...kinds, kind];

    // 전부 끄면 출제할 게 없어진다 — 서버도 최소 하나는 남긴다.
    if (next.length === 0) return;

    setSaving(true);
    setError(undefined);
    try {
      await updateWordBook(book.id, {
        title: book.title,
        description: book.description,
        cardKinds: next,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "바꾸지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  if (!book) {
    return (
      <main className="mx-auto w-full max-w-3xl px-8 py-14 lg:px-12">
        <PageHeader title="단어장을 찾을 수 없습니다" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-8 py-14 lg:px-12">
      <PageHeader title={book.title} description="설정" />

      <p className="text-sm font-medium text-ink">카드 종류</p>
      <p className="mt-0.5 text-xs text-umber/45">
        단어 하나가 고른 종류만큼 카드가 됩니다. 종류마다 복습 일정이 따로 갑니다.
      </p>

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        {(Object.keys(CARD_KIND_LABELS) as CardKind[]).map((kind) => {
          const on = kinds.includes(kind);
          return (
            <SubtleButton
              key={kind}
              aria-pressed={on}
              disabled={saving}
              onClick={() => void toggle(kind)}
              className={cn(
                "px-3.5 py-1.5 text-xs",
                on && "border-ink bg-ink text-cream hover:text-cream",
              )}
            >
              {CARD_KIND_LABELS[kind]}
            </SubtleButton>
          );
        })}
      </div>

      {error ? <p className="mt-6 text-sm text-red-700">{error}</p> : null}

      <div className="mt-10">
        <SubtleButton
          className="py-1.5 text-xs"
          onClick={() => router.push(`/word-books/${book.id}`)}
        >
          돌아가기
        </SubtleButton>
      </div>
    </main>
  );
}
