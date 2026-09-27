"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  FieldLabel,
  GhostButton,
  PageHeader,
  PrimaryButton,
  TextInput,
} from "@/components/ui";
import { useVocab } from "@/lib/vocab-store";

/**
 * 폴더 만들기. 단어장 만들기와 같은 모양이다.
 *
 * 처음에는 브라우저 prompt로 받았는데, 단어장은 별도 화면인데 폴더만 회색
 * 팝업이라 다른 물건처럼 보였다. 폴더에는 이름 말고 담을 정보가 없어서
 * 칸은 하나뿐이다.
 *
 * 경로가 `/word-books/folders/new`인 이유는 사이드바가 이 자리(word-books
 * 레이아웃)에만 있어서다. 루트에 두면 폴더를 만드는 동안 사이드바가 사라진다.
 */
export default function NewFolderPage() {
  const router = useRouter();
  const { createFolder } = useVocab();

  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (saving) return;

    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError("폴더 이름을 입력해 주세요");
      return;
    }
    setTitleError(undefined);

    setSaving(true);
    try {
      await createFolder(trimmed);
      router.push("/word-books");
    } catch (reason) {
      window.alert(
        reason instanceof Error ? reason.message : "폴더를 만들지 못했어요.",
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

      <PageHeader
        title="폴더 만들기"
        description="단어장을 묶어 둡니다. 만든 뒤 단어장을 끌어다 넣으세요."
      />

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
            placeholder="정보처리기사"
            autoFocus
          />
          {titleError ? (
            <p className="mt-1 text-xs text-red-700">{titleError}</p>
          ) : null}
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
