import Link from "next/link";

import type { Pack } from "@/lib/packs";
import { cn } from "@/lib/utils";

/** 팩 위아래의 톱니 모양 봉합선. */
function Seal({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "h-4 bg-[#d9b4b4] bg-[repeating-linear-gradient(90deg,rgba(0,0,0,0.10)_0_2px,transparent_2px_6px)]",
        className,
      )}
    />
  );
}

/**
 * 카드 팩 겉면 — 봉합선 · 냐키 그림(또는 큰 글자) · 레벨 · 장수. 마우스를 올리면
 * 살짝 들린다. 실물 포장처럼 테마와 상관없이 같은 색이다.
 */
export function PackFace({
  count,
  level,
  label,
  glyph,
  cover,
  small = false,
}: {
  count: number;
  level: string;
  label: string;
  glyph?: string;
  cover?: string;
  small?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative w-[200px] overflow-hidden rounded-xl shadow-[0_18px_40px_-12px_rgba(0,0,0,0.45)] ring-1 ring-black/10 transition duration-300 group-hover:-translate-y-1.5 group-hover:rotate-[-2deg] sm:w-[230px]",
        small && "w-[150px] sm:w-[150px]",
      )}
    >
      <Seal />
      <div className="relative flex aspect-[5/6] flex-col items-center bg-[linear-gradient(160deg,#f7e9e9_0%,#efd6d6_55%,#e6c3c3_100%)] px-4 pt-4">
        {/* 포일처럼 비스듬히 지나가는 빛 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.55)_45%,transparent_60%)] opacity-60 transition-opacity duration-300 group-hover:opacity-100"
        />
        <div className="relative flex w-full items-start justify-between">
          <span className="font-mono text-xs text-neutral-700">/\.u./\</span>
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-neutral-700">
            {count}장
          </span>
        </div>
        <p
          className={cn(
            "relative mt-2 text-3xl font-black tracking-tight text-neutral-900",
            small && "mt-1 text-xl",
          )}
        >
          JLPT {level}
        </p>
        <p
          className={cn(
            "relative text-[11px] font-medium tracking-[0.25em] text-neutral-600",
            small && "text-[9px]",
          )}
        >
          {label}
        </p>
        {glyph && !cover ? (
          <p
            aria-hidden
            className={cn(
              "relative my-auto font-serif text-[88px] font-bold leading-none text-neutral-900",
              small && "text-[56px]",
            )}
          >
            {glyph}
          </p>
        ) : null}
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            width={1792}
            height={2400}
            className="relative mt-auto block h-auto w-[78%]"
          />
        ) : null}
      </div>
      <Seal />
    </div>
  );
}

/** 팩 겉면에 쓰는 값 — 레벨은 첫 단어에서 읽는다. */
export function packFaceProps(pack: Pack) {
  return {
    count: pack.words.length,
    level: pack.tags.includes("JLPT") ? (pack.words[0]?.level ?? "") : "",
    label: pack.face?.label ?? "CARDS",
    glyph: pack.face?.glyph,
    cover: pack.cover,
  };
}

/** 덱 안에 나란히 놓이는 팩의 작은 카드. */
export function PackTile({
  pack,
  imported,
}: {
  pack: Pack;
  imported: boolean;
}) {
  return (
    <Link
      href={`/downloads/${pack.id}`}
      className="group flex flex-col items-center gap-4 rounded-2xl border border-taupe/40 p-5 text-center transition hover:border-taupe"
    >
      <PackFace {...packFaceProps(pack)} small />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{pack.title}</p>
        <p className="mt-1 text-xs text-umber/50">
          {pack.words.length}자{imported ? " · 담은 팩" : ""}
        </p>
      </div>
    </Link>
  );
}
