"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { PageHeader, PrimaryButton, SubtleButton, TextArea } from "@/components/ui";
import {
  fetchClozeNotes,
  putClozeNote,
  removeClozeNote,
} from "@/lib/api-client";
import { useVocab } from "@/lib/vocab-store";

/** 빈칸 노트 수정. 단어와 마찬가지로 목록에서 눌러 들어온다. */
export default function ClozeNotePage() {
  const params = useParams<{ id: string; noteId: string }>();
  const router = useRouter();
  const { getToken } = useAuth();
  const { refresh } = useVocab();

  const [text, setText] = useState("");
  const [createdAt, setCreatedAt] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const notes = await fetchClozeNotes(token, params.id);
    const note = notes.find((value) => value.id === params.noteId);
    if (!note) {
      setError("빈칸 노트를 찾을 수 없어요.");
      return;
    }
    setText(note.text);
    setCreatedAt(note.createdAt);
  }, [getToken, params.id, params.noteId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch {
        if (!cancelled) setError("불러오지 못했어요.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const blanks = new Set(
    [...text.matchAll(/\{\{c(\d+)::/g)].map((match) => match[1]),
  );

  async function save() {
    if (saving || blanks.size === 0) return;
    setSaving(true);
    setError(undefined);
    try {
      const token = await getToken();
      if (!token) throw new Error("로그인이 필요합니다.");
      // 생성 시각을 그대로 보낸다 — 안 보내면 만든 날짜가 오늘로 바뀐다.
      await putClozeNote(token, params.id, params.noteId, text, createdAt);
      await refresh();
      router.push(`/word-books/${params.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "저장하지 못했어요.");
      setSaving(false);
    }
  }

  async function remove() {
    if (saving || !window.confirm("이 빈칸 노트를 삭제할까요?")) return;
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("로그인이 필요합니다.");
      await removeClozeNote(token, params.id, params.noteId);
      await refresh();
      router.push(`/word-books/${params.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "삭제하지 못했어요.");
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-8 py-14 lg:px-12">
      <PageHeader
        title="빈칸"
        description="가릴 부분을 {{c1::답}} 으로 감쌉니다. 번호를 늘리면 카드가 늘어납니다."
      />

      {loading ? (
        <p className="text-sm text-umber/40">불러오는 중…</p>
      ) : (
        <>
          <TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            aria-label="빈칸 문장"
            className="w-full text-base"
          />

          {error ? <p className="mt-6 text-sm text-red-700">{error}</p> : null}

          <div className="mt-8 flex items-center justify-end gap-3">
            <span className="text-xs text-umber/45">
              {blanks.size === 0 ? "빈칸을 하나 이상" : `카드 ${blanks.size}장`}
            </span>
            <SubtleButton
              className="py-1.5 text-xs text-umber/45 hover:text-red-600"
              disabled={saving}
              onClick={() => void remove()}
            >
              삭제
            </SubtleButton>
            <PrimaryButton
              disabled={saving || blanks.size === 0}
              onClick={() => void save()}
            >
              {saving ? "저장 중…" : "저장"}
            </PrimaryButton>
          </div>
        </>
      )}
    </main>
  );
}
