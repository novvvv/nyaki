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
import { cn } from "@/lib/utils";
import { useVocab } from "@/lib/vocab-store";

type Target = "existing" | "new";

/**
 * 단어 묶음을 내 단어장에 담는 화면. 폴더 만들기와 같은 모양이다.
 *
 * 아직 목업이다 — 고르는 것까지만 되고 "담기"는 아무것도 저장하지 않는다.
 * 담을 때 PackWord의 level은 실제 단어에 넣을 칸이 없어서 빠진다.
 */
export default function SavePackPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const pack = getPack(params.id);
  const { wordBooks } = useVocab();

  // 단어장이 하나도 없으면 기존 단어장에 추가할 수 없으니 새 단어장으로 시작한다.
  const [target, setTarget] = useState<Target>(
    wordBooks.length > 0 ? "existing" : "new",
  );
  // 단어장 목록은 늦게 도착할 수 있다 — 고르기 전에는 첫 단어장을 보여준다.
  const [bookId, setBookId] = useState("");
  const [title, setTitle] = useState(pack?.title ?? "");

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
          // 목업 — 아직 저장하지 않는다.
          e.preventDefault();
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
              onChange={() => setTarget("existing")}
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
              onChange={() => setTarget("new")}
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
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-taupe/25 pt-6">
          <PrimaryButton type="submit">담기</PrimaryButton>
          <GhostButton type="button" onClick={() => router.back()}>
            취소
          </GhostButton>
        </div>
      </form>
    </main>
  );
}
