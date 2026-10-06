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
  const { getWordBook, updateWordBook, folders, moveWordBook } = useVocab();

  const book = getWordBook(params.id);

  const [title, setTitle] = useState(book?.title ?? "");
  const [description, setDescription] = useState(book?.description ?? "");
  // 빈 값이면 폴더 밖이다. 좁은 화면에는 끌어서 옮길 사이드바가 없어서 여기서 고른다.
  const [folderId, setFolderId] = useState(book?.folderId ?? "");
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
  const currentFolder = book.folderId ?? "";
  const folderChanged = folderId !== currentFolder;
  const changed =
    trimmed !== book.title ||
    description.trim() !== (book.description ?? "") ||
    folderChanged;

  async function save() {
    if (!book || saving || trimmed.length === 0) return;
    setSaving(true);
    setError(undefined);
    try {
      // 폴더 이동은 사이드바 드래그와 같은 길로 — 옮긴 폴더의 맨 뒤 자리도 같이
      // 잡는다. **이름 저장보다 먼저 한다.** moveWordBook은 화면이 들고 있던
      // 이름 · 설명을 같이 보내서, 나중에 부르면 방금 바꾼 이름을 되돌린다.
      // 이름 저장은 폴더를 안 보내니(서버가 기존 값 유지) 이동이 지워지지 않는다.
      if (folderChanged) await moveWordBook(book.id, folderId || null);
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

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">폴더</span>
          <select
            value={folderId}
            onChange={(event) => setFolderId(event.target.value)}
            className="w-full rounded-lg border border-taupe/45 bg-cream px-3 py-2 text-sm text-ink outline-none transition focus:border-ink/25 focus:ring-2 focus:ring-taupe/35"
          >
            <option value="">폴더 없음</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.title}
              </option>
            ))}
          </select>
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
