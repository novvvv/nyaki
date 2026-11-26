"use client";

import Link from "next/link";

import { PackFace } from "@/components/pack-face";
import { PageHeader } from "@/components/ui";
import { DECKS, type Deck } from "@/lib/packs";
import { useVocab } from "@/lib/vocab-store";

function DeckItem({ deck, imported }: { deck: Deck; imported: number }) {
  const count = deck.packs.reduce((sum, pack) => sum + pack.words.length, 0);
  const level = deck.packs[0]?.words[0]?.level ?? "";
  return (
    <Link
      href={`/downloads/${deck.id}`}
      className="group flex flex-col items-center gap-6 rounded-2xl border border-taupe/40 p-6 transition hover:border-taupe sm:flex-row sm:items-center sm:gap-10 sm:p-8"
    >
      <PackFace
        count={count}
        level={level}
        label={deck.face.label}
        cover={deck.cover}
      />
      <div className="min-w-0 text-center sm:text-left">
        <p className="text-lg font-semibold text-ink">{deck.title}</p>
        <p className="mt-1 text-sm text-umber/55">
          {deck.source} · {count}자 · {deck.packs.length}개 팩
        </p>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-ink/60">
          {deck.description}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <span className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-cream transition group-hover:bg-ink/85">
            덱 열어보기
          </span>
          {imported > 0 ? (
            <span className="text-xs text-umber/45">
              {imported}개 팩을 담았어요
            </span>
          ) : null}
        </div>
        <p className="mt-4 text-xs text-ink/30">{deck.updatedAt} 업데이트</p>
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
        {DECKS.map((deck) => (
          <DeckItem
            key={deck.id}
            deck={deck}
            imported={
              deck.packs.filter((pack) => importedPackIds.has(pack.id)).length
            }
          />
        ))}
      </div>
    </main>
  );
}
