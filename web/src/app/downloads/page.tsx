"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge, Card, PageHeader, TextInput } from "@/components/ui";
import { PACKS, type Pack } from "@/lib/packs";

const CATEGORIES = ["전체", "일본어"] as const;

function PackCard({ pack }: { pack: Pack }) {
  return (
    <Link href={`/downloads/${pack.id}`} className="group block">
      <Card className="flex h-full flex-col gap-4 bg-card transition group-hover:border-taupe">
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

        <div className="mt-auto border-t border-taupe/30 pt-3">
          <span className="text-xs text-ink/30">{pack.updatedAt} 업데이트</span>
        </div>
      </Card>
    </Link>
  );
}

export default function DownloadsPage() {
  const [category, setCategory] = useState<string>("전체");
  const [query, setQuery] = useState("");

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
          <PackCard key={pack.id} pack={pack} />
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
