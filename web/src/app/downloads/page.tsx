"use client";

import Link from "next/link";

import { PageHeader } from "@/components/ui";
import { PACKS, type Pack } from "@/lib/packs";
import { cn } from "@/lib/utils";
import { useVocab } from "@/lib/vocab-store";

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
 * 카드 팩 겉면 — 봉합선 · 냐키 그림 · 레벨 · 장수. 마우스를 올리면 살짝 들린다.
 * 실물 포장처럼 테마와 상관없이 같은 색이다.
 */
function PackFace({ pack }: { pack: Pack }) {
  const level = pack.tags.includes("JLPT") ? (pack.words[0]?.level ?? "") : "";
  return (
    <div className="relative w-[200px] overflow-hidden rounded-xl shadow-[0_18px_40px_-12px_rgba(0,0,0,0.45)] ring-1 ring-black/10 transition duration-300 group-hover:-translate-y-1.5 group-hover:rotate-[-2deg] sm:w-[230px]">
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
            {pack.words.length}장
          </span>
        </div>
        <p className="relative mt-2 text-3xl font-black tracking-tight text-neutral-900">
          JLPT {level}
        </p>
        <p className="relative text-[11px] font-medium tracking-[0.25em] text-neutral-600">
          PICTURE CARDS
        </p>
        {pack.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pack.cover}
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

function PackItem({ pack, imported }: { pack: Pack; imported: boolean }) {
  return (
    <Link
      href={`/downloads/${pack.id}`}
      className="group flex flex-col items-center gap-6 rounded-2xl border border-taupe/40 p-6 transition hover:border-taupe sm:flex-row sm:items-center sm:gap-10 sm:p-8"
    >
      <PackFace pack={pack} />
      <div className="min-w-0 text-center sm:text-left">
        <p className="text-lg font-semibold text-ink">{pack.title}</p>
        <p className="mt-1 text-sm text-umber/55">{pack.source}</p>
        <p className="mt-4 text-sm leading-relaxed text-ink/60">
          단어마다 그림 한 장. 장면으로 먼저 기억하는 N5 기본 단어예요.
          <br />
          쇼츠에 공개되는 카드가 생길 때마다 이 팩에 계속 추가돼요.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <span className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-cream transition group-hover:bg-ink/85">
            팩 열어보기
          </span>
          {imported ? (
            <span className="text-xs text-umber/45">이미 담은 팩이에요</span>
          ) : null}
        </div>
        <p className="mt-4 text-xs text-ink/30">{pack.updatedAt} 업데이트</p>
      </div>
    </Link>
  );
}

export default function DownloadsPage() {
  const { packImports } = useVocab();
  const importedPackIds = new Set(packImports.map((record) => record.packId));

  return (
    <main className="mx-auto w-full max-w-4xl break-keep px-8 py-14 lg:px-12">
      <PageHeader
        title="단어 다운로드"
        description="냐키가 만든 단어 팩이에요. 열어서 카드를 보고 내 단어장에 담아 보세요."
      />

      <div className="grid gap-6">
        {PACKS.map((pack) => (
          <PackItem
            key={pack.id}
            pack={pack}
            imported={importedPackIds.has(pack.id)}
          />
        ))}
      </div>
    </main>
  );
}
