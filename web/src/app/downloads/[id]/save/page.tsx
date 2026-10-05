"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import {
  FieldLabel,
  GhostButton,
  PageHeader,
  PrimaryButton,
  TextInput,
} from "@/components/ui";
import { getPack } from "@/lib/packs";
import { cn, newId } from "@/lib/utils";
import { useVocab } from "@/lib/vocab-store";

type Target = "existing" | "new";

/**
 * 단어 묶음을 내 단어장에 담는 화면. 폴더 만들기와 같은 모양이다.
 *
 * 단어장 생성 · 단어 추가 · 담은 기록은 서버가 한 번에 처리한다. 담을 때
 * PackWord의 level은 실제 단어에 넣을 칸이 없어서 빠진다.
 *
 * 같은 묶음을 이미 담았어도 막지 않는다. 경고만 하고 그대로 또 담는다.
 */
export default function SavePackPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const pack = getPack(params.id);
  const { wordBooks, folders, packImports, importPack } = useVocab();

  // 단어장 목록은 늦게 도착할 수 있다. 사용자가 고르기 전에는 목록을 보고
  // 정한다 — 첫 렌더에 정해버리면 단어장이 있는데도 "새 단어장"에 묶인다.
  const [chosen, setChosen] = useState<Target | null>(null);
  const target = chosen ?? (wordBooks.length > 0 ? "existing" : "new");
  const [bookId, setBookId] = useState("");
  const [title, setTitle] = useState(pack?.title ?? "");
  // 빈 값이면 폴더 밖이다.
  const [folderId, setFolderId] = useState("");
  const [titleError, setTitleError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  // 한 번 만들어 두고 재시도에도 그대로 보낸다 — 응답이 끊겨 다시 눌러도
  // 서버가 같은 요청으로 알아보고 두 번 넣지 않는다.
  const [importId] = useState(() => newId("import"));

  if (!pack) {
    return (
      <main className="mx-auto w-full max-w-6xl px-8 py-14 lg:px-12">
        <PageHeader title="단어 묶음을 찾을 수 없습니다" />
        <Link
          href="/downloads"
          className="text-sm text-umber/55 hover:text-ink"
        >
          단어 다운로드로 돌아가기
        </Link>
      </main>
    );
  }

  // 이 묶음을 담은 단어장 이름. 지운 단어장은 서버가 이미 뺐다.
  const importedInto = packImports
    .filter((record) => record.packId === pack.id)
    .map((record) => wordBooks.find((book) => book.id === record.wordBookId))
    .filter((book) => book !== undefined)
    .map((book) => `「${book.title}」`);

  async function handleSubmit() {
    if (!pack || saving) return;

    const trimmed = title.trim();
    if (target === "new" && !trimmed) {
      setTitleError("단어장 이름을 입력해 주세요");
      return;
    }
    setTitleError(undefined);
    setSaveError(undefined);

    setSaving(true);
    try {
      const savedBookId = await importPack({
        importId,
        packId: pack.id,
        words: pack.words,
        target:
          target === "existing"
            ? { type: "existing", wordBookId: bookId || wordBooks[0]!.id }
            : { type: "new", title: trimmed, folderId: folderId || null },
      });
      router.push(`/word-books/${savedBookId}`);
    } catch (reason) {
      setSaveError(
        reason instanceof Error ? reason.message : "단어장에 담지 못했어요.",
      );
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-8 py-14 lg:px-12">
      <div className="mb-7 flex items-center gap-1.5 text-xs text-umber/40">
        <Link href="/downloads" className="transition-colors hover:text-ink">
          단어 다운로드
        </Link>
        <span>/</span>
        <Link
          href={`/downloads/${pack.id}`}
          className="transition-colors hover:text-ink"
        >
          {pack.title}
        </Link>
      </div>

      <PageHeader
        title="내 단어장에 담기"
        description={`${pack.title} · ${pack.words.length}개`}
      />

      <form
        className="max-w-xl space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <div>
          <label
            className={cn(
              "flex items-center gap-2.5 text-sm text-ink",
              wordBooks.length === 0 && "text-ink/30",
            )}
          >
            <input
              type="radio"
              name="target"
              checked={target === "existing"}
              disabled={wordBooks.length === 0}
              onChange={() => setChosen("existing")}
              className="accent-ink"
            />
            기존 단어장에 추가
          </label>
          {target === "existing" ? (
            <div className="mt-3 pl-6">
              <FieldLabel>단어장</FieldLabel>
              <select
                value={bookId || wordBooks[0]?.id}
                onChange={(e) => setBookId(e.target.value)}
                className="w-full rounded-lg border border-taupe/45 bg-cream px-3 py-2 text-sm text-ink outline-none transition focus:border-ink/25 focus:ring-2 focus:ring-taupe/35"
              >
                {wordBooks.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div>
          <label className="flex items-center gap-2.5 text-sm text-ink">
            <input
              type="radio"
              name="target"
              checked={target === "new"}
              onChange={() => setChosen("new")}
              className="accent-ink"
            />
            새 단어장에 추가
          </label>
          {target === "new" ? (
            <div className="mt-3 pl-6">
              <FieldLabel>이름</FieldLabel>
              <TextInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {titleError ? (
                <p className="mt-1 text-xs text-red-700">{titleError}</p>
              ) : null}
              {folders.length > 0 ? (
                <div className="mt-4">
                  <FieldLabel>폴더</FieldLabel>
                  <select
                    value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}
                    className="w-full rounded-lg border border-taupe/45 bg-cream px-3 py-2 text-sm text-ink outline-none transition focus:border-ink/25 focus:ring-2 focus:ring-taupe/35"
                  >
                    <option value="">폴더 없음</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-3 border-t border-taupe/25 pt-6">
          {importedInto.length > 0 ? (
            <p className="text-xs text-red-700">
              이미 {importedInto.join(", ")}에 담은 묶음이에요. 다시 담으면 같은
              단어가 또 들어가요.
            </p>
          ) : null}
          {saveError ? (
            <p className="text-xs text-red-700">{saveError}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5">
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? "담는 중…" : "담기"}
            </PrimaryButton>
            <GhostButton type="button" onClick={() => router.back()}>
              취소
            </GhostButton>
          </div>
        </div>
      </form>
    </main>
  );
}
