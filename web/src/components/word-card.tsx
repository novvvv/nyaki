import type { PackWord } from "@/lib/packs";
import { cn } from "@/lib/utils";

/**
 * 실물 카드처럼 — 흰 테두리 · 그림 · 단어 · 번호. 다크모드에서도 카드는 흰색이라
 * 글자 색을 테마 토큰 대신 고정 색으로 둔다. 그림이 있는 단어만 넘긴다.
 */
export function WordCard({
  word,
  no,
  className,
}: {
  word: PackWord & { image: NonNullable<PackWord["image"]> };
  /** 카드 번호 — 1부터. */
  no: number;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "rounded-2xl bg-white p-2 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.35)] ring-1 ring-black/10",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={word.image.src}
        alt={`${word.meaning}(${word.term}) 그림 카드`}
        width={word.image.width}
        height={word.image.height}
        loading="lazy"
        className="block aspect-[4/5] w-full rounded-xl object-cover object-top ring-1 ring-black/5"
      />
      <figcaption className="px-1 pt-2 text-center">
        <p className="text-[11px] leading-none text-neutral-500">
          {word.reading}
        </p>
        <p className="mt-1 whitespace-nowrap text-xl font-semibold leading-none text-neutral-900 sm:text-3xl">
          {word.term}
        </p>
        <p className="mt-1.5 text-xs text-neutral-600">{word.meaning}</p>
        <div className="mt-2 flex items-center justify-between border-t border-neutral-200 pt-1.5 text-[10px] font-medium tracking-wider text-neutral-400">
          <span>JLPT {word.level ?? "N5"}</span>
          <span>No.{String(no).padStart(3, "0")}</span>
        </div>
      </figcaption>
    </figure>
  );
}

/** 그림이 있는 단어만 — WordCard에 넘길 수 있는 모양으로 좁힌다. */
export function pictureWords(words: PackWord[]) {
  return words.filter(
    (word): word is PackWord & { image: NonNullable<PackWord["image"]> } =>
      word.image !== undefined,
  );
}
