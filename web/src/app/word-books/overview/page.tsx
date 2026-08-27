"use client";

import { useMemo, useState } from "react";

import { WordAddedTrend } from "@/components/charts/word-added-trend";
import { Card, PageHeader } from "@/components/ui";
import {
  computeDailyWordCounts,
  computeOverviewSummary,
  type RangePreset,
} from "@/lib/stats";
import { useVocab } from "@/lib/vocab-store";

const RANGE_OPTIONS: { key: RangePreset; label: string }[] = [
  { key: 7, label: "7일" },
  { key: 30, label: "30일" },
  { key: 90, label: "90일" },
  { key: "all", label: "전체" },
];

export default function OverviewPage() {
  const { wordBooks, loading, error } = useVocab();
  const [range, setRange] = useState<RangePreset>(30);

  const summary = useMemo(() => computeOverviewSummary(wordBooks), [wordBooks]);
  const dailyCounts = useMemo(
    () => computeDailyWordCounts(wordBooks, range),
    [wordBooks, range],
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-8 py-14 lg:px-12">
      <PageHeader title="전체 통계" description="모든 단어장을 합친 추이예요." />

      {error ? <p className="mb-6 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-umber/40">불러오는 중…</p>
      ) : wordBooks.length === 0 ? (
        <p className="text-sm text-umber/40">
          단어장을 먼저 만들면 여기에 통계가 표시돼요.
        </p>
      ) : (
        <div className="space-y-8">
          <dl className="grid grid-cols-3 gap-3">
            <StatTile label="단어장" value={summary.totalBooks} />
            <StatTile label="전체 단어" value={summary.totalWords} />
            <StatTile label="즐겨찾기" value={summary.bookmarkedCount} />
          </dl>

          <Card className="px-5 py-5">
            <div className="mb-4 flex items-center gap-3.5">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setRange(opt.key)}
                  className={`text-xs transition ${
                    range === opt.key
                      ? "font-semibold text-ink"
                      : "font-medium text-umber/45 hover:text-umber/70"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <WordAddedTrend data={dailyCounts} />
          </Card>
        </div>
      )}
    </main>
  );
}

function StatTile({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <Card className="px-4 py-3.5">
      <dt className="text-xs text-umber/50">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">
        {value}
        {suffix ?? ""}
      </dd>
    </Card>
  );
}
