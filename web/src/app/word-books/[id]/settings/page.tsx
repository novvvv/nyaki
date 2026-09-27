"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import {
  PageHeader,
  PrimaryButton,
  SubtleButton,
  TextArea,
  TextInput,
} from "@/components/ui";
import { useVocab } from "@/lib/vocab-store";

/**
 * 단어장 설정 — 이름과 설명.
 *
 * 만들 때 한 번 받고 끝이라 고칠 방법이 없었다. 서버는 처음부터 `PUT`으로
 * 받아주고 있었고(보낸 필드만 덮어쓴다), 화면만 없었다.
 */
export default function WordBookSettingsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { getWordBook, updateWordBook } = useVocab();

  const book = getWordBook(params.id);

  const [title, setTitle] = useState(book?.title ?? "");
  const [description, setDescription] = useState(book?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  if (!book) {
    return (
      <main className="mx-auto w-full max-w-3xl px-8 py-14 lg:px-12">
        <PageHeader title="단어장을 찾을 수 없습니다" />
      </main>
    );
  }

  const trimmed = title.trim();
  const changed =
    trimmed !== book.title || description.trim() !== (book.description ?? "");

  async function save() {
    if (!book || saving || trimmed.length === 0) return;
    setSaving(true);
    setError(undefined);
    try {
      await updateWordBook(book.id, {
        title: trimmed,
        description: description.trim() || undefined,
      });
      router.push(`/word-books/${book.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "저장하지 못했어요.");
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-8 py-14 lg:px-12">
      <PageHeader title={book.title} description="설정" />

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">이름</span>
          <TextInput
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            onKeyDown={(event) => {
              if (event.key === "Enter") void save();
            }}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">설명</span>
          <TextArea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </label>
      </div>

      {error ? <p className="mt-6 text-sm text-red-700">{error}</p> : null}

      <div className="mt-8 flex items-center justify-end gap-3">
        <SubtleButton
          className="py-1.5 text-xs"
          onClick={() => router.push(`/word-books/${book.id}`)}
        >
          취소
        </SubtleButton>
        <PrimaryButton
          disabled={saving || trimmed.length === 0 || !changed}
          onClick={() => void save()}
        >
          {saving ? "저장 중…" : "저장"}
        </PrimaryButton>
      </div>
    </main>
  );
}
