"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import {
  FieldLabel,
  GhostButton,
  PageHeader,
  PrimaryButton,
  TextArea,
  TextInput,
} from "@/components/ui";
import { WordPhotoField, type PhotoChange } from "@/components/word-photo-field";
import { removeWordPhoto, uploadWordPhoto } from "@/lib/api-client";
import { WORD_PAGE_SIZE } from "@/lib/constants";
import { PHOTO_MESSAGES } from "@/lib/photo";
import { WORD_LIMITS } from "@/lib/word-limits";
import { activeWords, useVocab } from "@/lib/vocab-store";
import type { WordInput } from "@/lib/types";

interface WordFormProps {
  mode: "create" | "edit";
}

export function WordForm({ mode }: WordFormProps) {
  const params = useParams<{ id: string; wordId?: string }>();
  const router = useRouter();
  const { getWordBook, createWord, updateWord, deleteWord, replaceWord } =
    useVocab();
  const { getToken } = useAuth();

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
    exampleMeaning: existing?.exampleMeaning ?? "",
    isBookmarked: existing?.isBookmarked ?? false,
    tags: existing?.tags ?? [],
  }));
  const [tagsText, setTagsText] = useState(
    () => (existing?.tags ?? []).join(", "),
  );
  const [errors, setErrors] = useState<{
    term?: string;
    meaning?: string;
    tags?: string;
  }>({});
  const [photo, setPhoto] = useState<PhotoChange>(null);
  const [saving, setSaving] = useState(false);

  if (!book) {
    return (
      <main className="mx-auto w-full max-w-6xl px-8 py-14 lg:px-12">
        <PageHeader title="단어장을 찾을 수 없습니다" />
      </main>
    );
  }

  if (mode === "edit" && !existing) {
    return (
      <main className="mx-auto w-full max-w-6xl px-8 py-14 lg:px-12">
        <PageHeader title="단어를 찾을 수 없습니다" />
      </main>
    );
  }

  function splitTags(text: string) {
    return text
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }

  function validate() {
    const tags = splitTags(tagsText);
    const next = {
      term: form.term.trim() ? undefined : "단어를 입력해 주세요",
      meaning: form.meaning.trim() ? undefined : "의미를 입력해 주세요",
      tags:
        tags.length > WORD_LIMITS.tags
          ? `태그는 ${WORD_LIMITS.tags}개까지 넣을 수 있어요`
          : tags.some((tag) => tag.length > WORD_LIMITS.tag)
            ? `태그 하나는 ${WORD_LIMITS.tag}자까지예요`
            : undefined,
    };
    setErrors(next);
    return !next.term && !next.meaning && !next.tags;
  }

  async function handleSubmit() {
    if (!book || !validate()) return;

    const tags = splitTags(tagsText);
    const payload: WordInput = { ...form, tags };

    setSaving(true);
    try {
      if (mode === "create") {
        const created = await createWord(book.id, payload);
        await applyPhoto(created.id);
        // 새 단어는 목록 맨 끝에 추가되므로(전체/최신순 기준), 그 단어가
        // 실제로 있는 페이지로 이동한다 — 항상 1페이지로 보내지 않는다.
        const newCount = activeWords(book).length + 1;
        const targetPage = Math.ceil(newCount / WORD_PAGE_SIZE);
        router.push(`/word-books/${book.id}?page=${targetPage}`);
      } else {
        if (existing) {
          await updateWord(book.id, existing.id, payload);
          await applyPhoto(existing.id);
        }
        router.push(`/word-books/${book.id}`);
      }
    } catch (reason) {
      window.alert(
        reason instanceof Error ? reason.message : "단어를 저장하지 못했어요.",
      );
    } finally {
      setSaving(false);
    }
  }

  /**
   * 단어를 저장한 뒤 사진을 올리거나 뺀다. 새 단어는 서버에 생긴 뒤라야 사진을
   * 붙일 수 있다. 사진만 실패하면 단어는 저장된 채로 알려 준다 — 다시 누르면
   * 새 단어가 하나 더 생기니 폼에 머물지 않는다.
   */
  async function applyPhoto(wordId: string) {
    if (!photo) return;
    try {
      const token = await getToken();
      if (!token) throw new Error(PHOTO_MESSAGES.failed);
      const word =
        photo.kind === "set"
          ? await uploadWordPhoto(token, wordId, photo.blob)
          : await removeWordPhoto(token, wordId);
      replaceWord(word);
    } catch (reason) {
      window.alert(
        reason instanceof Error ? reason.message : PHOTO_MESSAGES.failed,
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
    <main className="mx-auto w-full max-w-6xl px-8 py-14 lg:px-12">
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
            maxLength={WORD_LIMITS.term}
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
            maxLength={WORD_LIMITS.meaning}
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
            maxLength={WORD_LIMITS.pronunciation}
            placeholder="/kæt/"
          />
        </div>

        <div>
          <FieldLabel>설명</FieldLabel>
          <TextArea
            value={form.description ?? ""}
            onChange={(e) => setField("description", e.target.value)}
            maxLength={WORD_LIMITS.description}
            placeholder="추가 메모"
          />
        </div>

        <div>
          <FieldLabel>예문</FieldLabel>
          <TextArea
            value={form.example ?? ""}
            onChange={(e) => setField("example", e.target.value)}
            maxLength={WORD_LIMITS.example}
            placeholder="I have a cat."
          />
        </div>

        <div>
          <FieldLabel>예문 뜻</FieldLabel>
          <TextArea
            value={form.exampleMeaning ?? ""}
            onChange={(e) => setField("exampleMeaning", e.target.value)}
            maxLength={WORD_LIMITS.exampleMeaning}
            placeholder="나는 고양이가 있다."
          />
        </div>

        <WordPhotoField
          savedUrl={existing?.photoUrl}
          change={photo}
          onChange={setPhoto}
        />

        <div>
          <FieldLabel>태그</FieldLabel>
          <TextInput
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="N3, 조사 (쉼표로 구분)"
          />
          {errors.tags ? (
            <p className="mt-1 text-xs text-red-700">{errors.tags}</p>
          ) : null}
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
          <PrimaryButton type="submit" disabled={saving}>
            {saving && photo?.kind === "set"
              ? "올리는 중…"
              : mode === "create"
                ? "추가"
                : "저장"}
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
