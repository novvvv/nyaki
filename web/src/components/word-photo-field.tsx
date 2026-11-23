"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { FieldLabel, SubtleButton } from "@/components/ui";
import { useFeatures } from "@/lib/features";
import {
  PHOTO_ACCEPT,
  PhotoError,
  PHOTO_MESSAGES,
  shrinkPhoto,
} from "@/lib/photo";

/** 저장할 때 반영할 사진 변경. 고르기만 하고 저장 전에 나가면 아무것도 안 바뀐다. */
export type PhotoChange =
  { kind: "set"; blob: Blob; preview: string } | { kind: "remove" } | null;

/**
 * 단어 입력 화면의 사진 칸 — 유료 기능. 열린 계정은 사진을 고르고, 잠긴 계정은
 * 안내만 본다. 고른 사진은 줄여 두었다가 단어를 저장할 때 올린다(word-form.tsx).
 */
export function WordPhotoField({
  savedUrl,
  change,
  onChange,
}: {
  /** 이미 붙어 있는 사진 */
  savedUrl?: string | null;
  change: PhotoChange;
  onChange: (change: PhotoChange) => void;
}) {
  const features = useFeatures();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 미리보기 주소는 바뀌거나 화면을 떠날 때 놓아준다.
  useEffect(
    () => () => {
      if (change?.kind === "set") URL.revokeObjectURL(change.preview);
    },
    [change],
  );

  // 모르는 동안은 아무것도 안 보인다 — 잠금 안내가 번쩍이지 않게.
  if (features === null) return null;

  if (!features.cardPhotos) {
    return (
      <div className="rounded-2xl border border-dashed border-taupe/60 p-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#efd6d6] px-2 py-0.5 text-[11px] font-semibold text-ink">
            프리미엄
          </span>
          <p className="text-sm font-semibold text-ink">카드에 사진 넣기</p>
        </div>
        <p className="mt-1.5 text-xs text-umber/55">
          단어마다 사진을 붙여 그림으로 외워요. 곧 프리미엄으로 열려요.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <SubtleButton disabled className="rounded-full px-3 py-1.5 text-xs">
            준비 중
          </SubtleButton>
          <Link
            href="/pricing"
            className="text-xs text-umber/55 underline-offset-2 transition hover:text-ink hover:underline"
          >
            요금제 보기
          </Link>
        </div>
      </div>
    );
  }

  const shown =
    change?.kind === "set"
      ? change.preview
      : change?.kind === "remove"
        ? null
        : (savedUrl ?? null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const blob = await shrinkPhoto(file);
      onChange({ kind: "set", blob, preview: URL.createObjectURL(blob) });
    } catch (reason) {
      setError(
        reason instanceof PhotoError ? reason.message : PHOTO_MESSAGES.failed,
      );
    } finally {
      setBusy(false);
      // 같은 파일을 다시 골라도 onChange가 오게.
      if (input.current) input.current.value = "";
    }
  }

  function remove() {
    setError(null);
    // 저장된 사진을 빼는 것만 묻는다. 방금 고른 사진은 그냥 되돌린다.
    if (change?.kind === "set" && !savedUrl) {
      onChange(null);
      return;
    }
    if (!window.confirm("사진을 뺄까요? 이 단어의 카드에서 사진이 사라져요."))
      return;
    onChange({ kind: "remove" });
  }

  return (
    <div>
      <FieldLabel>사진</FieldLabel>
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shown}
          alt=""
          className="mb-3 max-h-56 w-auto max-w-full rounded-2xl border border-taupe/40 object-contain"
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <SubtleButton
          disabled={busy}
          onClick={() => input.current?.click()}
          className="rounded-full px-3 py-1.5 text-xs"
        >
          {shown ? "사진 바꾸기" : "사진 넣기"}
        </SubtleButton>
        {shown ? (
          <SubtleButton
            disabled={busy}
            onClick={remove}
            className="rounded-full px-3 py-1.5 text-xs"
          >
            사진 빼기
          </SubtleButton>
        ) : null}
      </div>
      <input
        ref={input}
        type="file"
        accept={PHOTO_ACCEPT}
        className="hidden"
        onChange={(event) => void pick(event.target.files?.[0])}
      />
      {error ? (
        <p className="mt-1.5 text-xs text-red-700">{error}</p>
      ) : (
        <p className="mt-1.5 text-xs text-umber/45">
          카드 앞면과 뒷면에 함께 보여요. JPG · PNG · WebP, 10MB 이하
        </p>
      )}
    </div>
  );
}
