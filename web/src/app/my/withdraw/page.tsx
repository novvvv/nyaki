"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth-provider";
import {
  FieldLabel,
  GhostButton,
  PageHeader,
  SubtleButton,
  TextInput,
} from "@/components/ui";
import { deleteAccount } from "@/lib/api-client";
import { bookMeta, useVocab } from "@/lib/vocab-store";

const CONFIRM_WORD = "탈퇴";

/**
 * 회원 탈퇴. 되돌릴 수 없어서 두 번 확인받는다 — "탈퇴"를 직접 입력해야
 * 버튼이 눌리고, 누르면 브라우저 확인 창이 한 번 더 뜬다.
 *
 * 마이페이지 안에 입력칸을 끼우지 않고 화면을 따로 둔다. 폴더 만들기처럼
 * 한 가지 일만 하는 화면이 다른 화면과 같은 모양이다.
 */
export default function WithdrawPage() {
  const router = useRouter();
  const { getToken, signOutUser } = useAuth();
  const { wordBooks, summaries } = useVocab();

  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();

  // 집계는 서버가 센 값(단어 + 빈칸 노트)이다. 아직 못 받았으면 단어만 센다.
  const itemCount = wordBooks.reduce(
    (sum, book) =>
      sum + (summaries[book.id]?.itemCount ?? bookMeta(book).count),
    0,
  );

  async function handleWithdraw() {
    if (typed.trim() !== CONFIRM_WORD || deleting) return;
    if (
      !window.confirm(
        "정말 탈퇴할까요?\n모든 데이터가 지워지고 되돌릴 수 없어요.",
      )
    ) {
      return;
    }

    setDeleting(true);
    setError(undefined);
    try {
      const token = await getToken();
      if (!token) throw new Error("로그인이 필요합니다.");
      await deleteAccount(token);
      // 서버가 Firebase 계정까지 지웠다. 이 브라우저의 로그인 상태만 정리한다.
      await signOutUser();
      router.replace("/login");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "탈퇴하지 못했어요.");
      setDeleting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-8 py-14 lg:px-12">
      <div className="mb-7 text-xs text-umber/40">
        <Link href="/my" className="transition-colors hover:text-ink">
          마이페이지
        </Link>
      </div>

      <PageHeader
        title="회원 탈퇴"
        description="탈퇴하면 아래 데이터가 모두 지워지고 되돌릴 수 없어요."
      />

      <form
        className="max-w-xl space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void handleWithdraw();
        }}
      >
        <ul className="space-y-1 text-sm text-ink">
          <li>· 단어장 {wordBooks.length}개</li>
          <li>· 단어 {itemCount}개</li>
          <li>· 복습 기록 · 재화 · 퀘스트 기록 전부</li>
        </ul>

        <div>
          <FieldLabel>
            확인을 위해 &ldquo;{CONFIRM_WORD}&rdquo;를 입력해 주세요
          </FieldLabel>
          <TextInput
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={CONFIRM_WORD}
            autoComplete="off"
          />
        </div>

        <div className="space-y-3 border-t border-taupe/25 pt-6">
          {error ? <p className="text-xs text-red-700">{error}</p> : null}
          <div className="flex flex-wrap items-center gap-1.5">
            <SubtleButton
              type="submit"
              disabled={typed.trim() !== CONFIRM_WORD || deleting}
              className="text-red-700 hover:text-red-700"
            >
              {deleting ? "탈퇴하는 중…" : "탈퇴하기"}
            </SubtleButton>
            <GhostButton type="button" onClick={() => router.back()}>
              취소
            </GhostButton>
          </div>
        </div>
      </form>
    </main>
  );
}
