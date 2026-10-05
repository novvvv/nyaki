"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge, Card, PageHeader, TextInput } from "@/components/ui";
import { LEVEL_TONE, PACKS, type JlptLevel, type Pack } from "@/lib/packs";
import { cn } from "@/lib/utils";
import { useVocab } from "@/lib/vocab-store";

const CATEGORIES = ["전체", "일본어"] as const;

/** 레벨 붙은 단어들의 평균(3.3이면 N3.3). 레벨이 하나도 없으면 undefined. */
function averageLevel(pack: Pack) {
  const levels = pack.words.flatMap((word) =>
    word.level ? [Number(word.level.slice(1))] : [],
  );
  if (levels.length === 0) return undefined;
  return levels.reduce((total, level) => total + level, 0) / levels.length;
}

function PackCard({ pack, imported }: { pack: Pack; imported: boolean }) {
  const average = averageLevel(pack);

  return (
    <Link href={`/downloads/${pack.id}`} className="group block">
      <Card
        className={cn(
          "flex h-full flex-col gap-4 transition group-hover:border-taupe",
          // 이미 담은 묶음은 카드 전체를 옅은 회색으로 칠한다. 다시 담는 건
          // 막지 않으니 눌러서 들어갈 수는 있다.
          imported ? "bg-subtle/60" : "bg-card",
        )}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{pack.title}</p>
          <p className="mt-1 truncate text-xs text-umber/45">{pack.source}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {pack.tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
          <span className="text-xs tabular-nums text-umber/45">
            {pack.words.length}개
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-taupe/30 pt-3">
          <span className="text-xs text-ink/30">{pack.updatedAt} 업데이트</span>
          {average !== undefined ? (
            <span className="flex items-center gap-1.5 text-xs text-umber/45">
              평균 난이도
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                  // 색은 반올림한 레벨을 따른다 — 3.3이면 N3.
                  LEVEL_TONE[`N${Math.round(average)}` as JlptLevel],
                )}
              >
                N{average.toFixed(1)}
              </span>
            </span>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}

export default function DownloadsPage() {
  const [category, setCategory] = useState<string>("전체");
  const [query, setQuery] = useState("");
  const { packImports } = useVocab();
  const importedPackIds = new Set(packImports.map((record) => record.packId));

  const packs = PACKS.filter((pack) => {
    const byCategory = category === "전체" || pack.tags.includes(category);
    const byQuery =
      !query.trim() || pack.title.toLowerCase().includes(query.toLowerCase());
    return byCategory && byQuery;
  });

  return (
    <main className="mx-auto w-full max-w-7xl px-8 py-14 lg:px-12">
      <PageHeader
        title="단어 다운로드"
        description="블로그 강의에서 정리한 단어 묶음입니다. 눌러서 단어를 확인하세요."
        actions={
          <TextInput
            className="w-48 py-1.5"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="단어장 검색"
          />
        }
      />

      <div className="mb-8 flex flex-wrap items-center gap-1.5">
        {CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs transition ${
              category === item
                ? "bg-ink text-cream"
                : "text-umber/55 hover:bg-subtle hover:text-ink"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {packs.map((pack) => (
          <PackCard
            key={pack.id}
            pack={pack}
            imported={importedPackIds.has(pack.id)}
          />
        ))}
      </div>

      {packs.length === 0 ? (
        <p className="py-16 text-center text-sm text-umber/45">
          조건에 맞는 단어장이 없습니다.
        </p>
      ) : null}
    </main>
  );
}
