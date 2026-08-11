"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  FieldLabel,
  GhostButton,
  PageHeader,
  PrimaryButton,
  TextArea,
  TextInput,
} from "@/components/ui";
import { activeWords, useVocab } from "@/lib/vocab-store";
import type { WordInput } from "@/lib/types";

interface WordFormProps {
  mode: "create" | "edit";
}

export function WordForm({ mode }: WordFormProps) {
  const params = useParams<{ id: string; wordId?: string }>();
  const router = useRouter();
  const { getWordBook, createWord, updateWord, deleteWord } = useVocab();

  const book = getWordBook(params.id);
  const existing = useMemo(() => {
    if (mode !== "edit" || !book || !params.wordId) return undefined;
    return activeWords(book).find((word) => word.id === params.wordId);
  }, [book, mode, params.wordId]);

  const [form, setForm] = useState<WordInput>(() => ({
    term: existing?.term ?? "",
    meaning: existing?.meaning ?? "",
    pronunciation: existing?.pronunciation ?? "",
    description: existing?.description ?? "",
    example: existing?.example ?? "",
    isBookmarked: existing?.isBookmarked ?? false,
    tags: existing?.tags ?? [],
  }));
  const [tagsText, setTagsText] = useState(
    () => (existing?.tags ?? []).join(", "),
  );
  const [errors, setErrors] = useState<{ term?: string; meaning?: string }>({});

  if (!book) {
    return (
      <main className="mx-auto w-full max-w-4xl px-8 py-14 lg:px-12">
        <PageHeader title="단어장을 찾을 수 없습니다" />
      </main>
    );
  }

  if (mode === "edit" && !existing) {
    return (
      <main className="mx-auto w-full max-w-4xl px-8 py-14 lg:px-12">
        <PageHeader title="단어를 찾을 수 없습니다" />
      </main>
    );
  }

  function validate() {
    const next = {
      term: form.term.trim() ? undefined : "단어를 입력해 주세요",
      meaning: form.meaning.trim() ? undefined : "의미를 입력해 주세요",
    };
    setErrors(next);
    return !next.term && !next.meaning;
  }

  async function handleSubmit() {
    if (!book || !validate()) return;

    const tags = tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    const payload: WordInput = { ...form, tags };

    try {
      if (mode === "create") {
        await createWord(book.id, payload);
      } else if (existing) {
        await updateWord(book.id, existing.id, payload);
      }
      router.push(`/word-books/${book.id}`);
    } catch (reason) {
      window.alert(
        reason instanceof Error ? reason.message : "단어를 저장하지 못했어요.",
      );
    }
  }

  async function handleDelete() {
    if (!book || !existing) return;
    if (!window.confirm(`"${existing.term}" 단어를 삭제할까요?`)) return;
    try {
      await deleteWord(book.id, existing.id);
      router.push(`/word-books/${book.id}`);
    } catch (reason) {
      window.alert(
        reason instanceof Error ? reason.message : "단어를 삭제하지 못했어요.",
      );
    }
  }

  function setField<K extends keyof WordInput>(key: K, value: WordInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-8 py-14 lg:px-12">
      <div className="mb-7 text-xs text-umber/40">
        <Link href="/word-books" className="transition-colors hover:text-ink">
          단어장
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/word-books/${book.id}`} className="transition-colors hover:text-ink">
          {book.title}
        </Link>
      </div>

      <PageHeader
        title={mode === "create" ? "단어 추가" : "단어 수정"}
        description={book.title}
      />

      <form
        className="max-w-xl space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <div>
          <FieldLabel>단어</FieldLabel>
          <TextInput
            value={form.term}
            onChange={(e) => setField("term", e.target.value)}
            placeholder="cat"
            autoFocus
          />
          {errors.term ? (
            <p className="mt-1 text-xs text-red-700">{errors.term}</p>
          ) : null}
        </div>

        <div>
          <FieldLabel>의미</FieldLabel>
          <TextInput
            value={form.meaning}
            onChange={(e) => setField("meaning", e.target.value)}
            placeholder="고양이"
          />
          {errors.meaning ? (
            <p className="mt-1 text-xs text-red-700">{errors.meaning}</p>
          ) : null}
        </div>

        <div>
          <FieldLabel>발음</FieldLabel>
          <TextInput
            value={form.pronunciation ?? ""}
            onChange={(e) => setField("pronunciation", e.target.value)}
            placeholder="/kæt/"
          />
        </div>

        <div>
          <FieldLabel>설명</FieldLabel>
          <TextArea
            value={form.description ?? ""}
            onChange={(e) => setField("description", e.target.value)}
            placeholder="추가 메모"
          />
        </div>

        <div>
          <FieldLabel>예문</FieldLabel>
          <TextArea
            value={form.example ?? ""}
            onChange={(e) => setField("example", e.target.value)}
            placeholder="I have a cat."
          />
        </div>

        <div>
          <FieldLabel>태그</FieldLabel>
          <TextInput
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="N3, 조사 (쉼표로 구분)"
          />
        </div>

        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-umber/60">
          <input
            type="checkbox"
            className="size-4 rounded border-taupe/60 accent-ink"
            checked={form.isBookmarked ?? false}
            onChange={(e) => setField("isBookmarked", e.target.checked)}
          />
          북마크
        </label>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-taupe/25 pt-6">
          <PrimaryButton type="submit">
            {mode === "create" ? "추가" : "저장"}
          </PrimaryButton>
          <GhostButton type="button" onClick={() => router.back()}>
            취소
          </GhostButton>
          {mode === "edit" ? (
            <GhostButton
              type="button"
              className="ml-auto text-umber/45 hover:bg-transparent hover:text-red-600"
              onClick={() => void handleDelete()}
            >
              삭제
            </GhostButton>
          ) : null}
        </div>
      </form>
    </main>
  );
}
