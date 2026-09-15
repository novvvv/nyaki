"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  FieldLabel,
  GhostButton,
  PageHeader,
  PrimaryButton,
  TextArea,
  TextInput,
} from "@/components/ui";
import { useVocab } from "@/lib/vocab-store";

export default function NewWordBookPage() {
  const router = useRouter();
  const { createWordBook } = useVocab();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [titleError, setTitleError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (saving) return;

    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError("단어장 이름을 입력해 주세요");
      return;
    }
    setTitleError(undefined);

    setSaving(true);
    try {
      const book = await createWordBook({
        title: trimmed,
        description: description.trim() || undefined,
      });
      router.push(`/word-books/${book.id}`);
    } catch (reason) {
      window.alert(
        reason instanceof Error ? reason.message : "단어장을 만들지 못했어요.",
      );
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-8 py-14 lg:px-12">
      <div className="mb-7 text-xs text-umber/40">
        <Link href="/word-books" className="transition-colors hover:text-ink">
          단어장
        </Link>
      </div>

      <PageHeader title="단어장 만들기" />

      <form
        className="max-w-xl space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <div>
          <FieldLabel>이름</FieldLabel>
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="비즈니스 일본어"
            autoFocus
          />
          {titleError ? (
            <p className="mt-1 text-xs text-red-700">{titleError}</p>
          ) : null}
        </div>

        <div>
          <FieldLabel>설명</FieldLabel>
          <TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="회의·메일에서 자주 쓰는 표현 모음"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-taupe/25 pt-6">
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? "만드는 중…" : "만들기"}
          </PrimaryButton>
          <GhostButton type="button" onClick={() => router.back()}>
            취소
          </GhostButton>
        </div>
      </form>
    </main>
  );
}
