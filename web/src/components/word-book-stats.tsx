"use client";

import { useMemo, useState } from "react";

import { ChartStatFlow } from "@/components/charts/chart-stat-flow";
import type { RingData } from "@/components/charts/ring-context";
import { Ring } from "@/components/charts/ring";
import { RingChart } from "@/components/charts/ring-chart";
import type { WordBook } from "@/lib/types";
import { activeWords } from "@/lib/vocab-store";

const RING_COLORS = ["var(--chart-1)", "var(--chart-3)"] as const;

export function WordBookStats({ book }: { book: WordBook }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const stats = useMemo(() => {
    const words = activeWords(book);
    const total = words.length;
    const memorized = words.filter(
      (word) => word.memorizationStatus === "memorized",
    ).length;
    const bookmarked = words.filter((word) => word.isBookmarked).length;
    return {
      total,
      memorized,
      unmemorized: total - memorized,
      bookmarked,
      rate: total === 0 ? 0 : Math.round((memorized / total) * 100),
    };
  }, [book]);

  const rings = useMemo<RingData[]>(
    () => [
      {
        label: "암기함",
        value: stats.memorized,
        maxValue: Math.max(1, stats.total),
        color: RING_COLORS[0],
      },
      {
        label: "즐겨찾기",
        value: stats.bookmarked,
        maxValue: Math.max(1, stats.total),
        color: RING_COLORS[1],
      },
    ],
    [stats],
  );

  const hoveredRing = hovered === null ? null : rings[hovered];

  if (stats.total === 0) return null;

  return (
    <section className="mb-10 flex flex-col gap-8 sm:flex-row sm:items-center">
      <div className="relative shrink-0 self-center">
        <RingChart
          baseInnerRadius={46}
          data={rings}
          hoveredIndex={hovered}
          onHoverChange={setHovered}
          ringGap={5}
          size={148}
          strokeWidth={13}
        >
          <Ring index={0} showGlow={false} />
          <Ring index={1} showGlow={false} />
        </RingChart>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <ChartStatFlow
            label={hoveredRing ? hoveredRing.label : "암기율"}
            labelClassName="text-[11px] text-umber/50"
            suffix={hoveredRing ? undefined : "%"}
            value={hoveredRing ? hoveredRing.value : stats.rate}
            valueClassName="text-[26px] font-semibold leading-none text-ink"
          />
        </div>
      </div>

      <dl className="grid flex-1 grid-cols-2 gap-x-8 gap-y-4 sm:max-w-sm">
        <StatItem label="전체" value={stats.total} />
        <StatItem
          label="암기함"
          value={stats.memorized}
          swatch={RING_COLORS[0]}
        />
        <StatItem label="미암기" value={stats.unmemorized} />
        <StatItem
          label="즐겨찾기"
          value={stats.bookmarked}
          swatch={RING_COLORS[1]}
        />
      </dl>
    </section>
  );
}

function StatItem({
  label,
  value,
  swatch,
}: {
  label: string;
  value: number;
  swatch?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-taupe/25 pb-2">
      <dt className="flex items-center gap-2 text-xs text-umber/55">
        {swatch ? (
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ background: swatch }}
          />
        ) : (
          <span aria-hidden className="size-2" />
        )}
        {label}
      </dt>
      <dd className="text-sm font-medium tabular-nums text-ink">{value}</dd>
    </div>
  );
}
