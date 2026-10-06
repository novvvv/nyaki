"use client";

import { useEffect, useRef, useState } from "react";

import { SubtleButton } from "@/components/ui";
import type { MasteryRow } from "@/lib/stats";
import { cn } from "@/lib/utils";

// 단어장별 암기율. 두 가지로 본다.
//
// 막대 — 단어장끼리 암기율 비교. 가로 막대인 이유: 암기율은 0~100으로 상한이
// 정해진 값이고, 비교 대상이 시간이 아니라 이름이 긴 단어장들이다.
// SVG를 고정 폭으로 그려 줄이면 폰에서 글씨까지 절반으로 작아져서, HTML로
// 그리고 막대만 남는 폭을 채운다.
//
// 곡선 — 단어장 안의 카드가 어느 암기 단계에 몰려 있는지. 오른쪽으로 갈수록
// 오래 기억하는 카드다. 막대의 단어장들을 곡선으로 이으면 의미가 없어서(단어장
// 사이에는 순서가 없다) 축을 "단계"로 바꿔 그린다.

/** 고른 적이 없을 때 보여줄 개수. 단어 많은 단어장부터. */
const DEFAULT_COUNT = 3;

const STORAGE_KEY = "nyaki.stats.masteryBooks";

/** 서버 집계(stages)와 같은 순서. api/app/vocab/services.py STAGE_LABELS */
const STAGE_LABELS = ["새 카드", "학습 중", "1일", "3일", "1주", "1달+"];

/**
 * 고른 단어장 id. 고른 적이 없으면 null — 빈 배열(전부 뺐다)과 구분한다.
 *
 * 이 브라우저에만 남는 화면 설정이다. 다른 기기에서는 기본 3개로 보인다.
 */
function loadSelected(): string[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : null;
  } catch {
    return null;
  }
}

function saveSelected(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // 사생활 보호 모드 등에서 막힐 수 있다. 기억 못 해도 동작에는 지장 없다.
  }
}

/** 기본으로 보여줄 단어장 — 단어(항목) 많은 순으로 3개. */
function defaultIds(data: MasteryRow[]): string[] {
  return [...data]
    .sort((a, b) => b.itemCount - a.itemCount)
    .slice(0, DEFAULT_COUNT)
    .map((row) => row.id);
}

type View = "bar" | "curve";

export function MasteryByBook({ data }: { data: MasteryRow[] }) {
  // 초기값으로 읽는다 — 이펙트에서 읽으면 기본 3개가 한 프레임 보였다 바뀐다.
  const [selected, setSelected] = useState<string[] | null>(loadSelected);
  const [picking, setPicking] = useState(false);
  const [view, setView] = useState<View>("bar");

  if (data.length === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center text-sm text-umber/40">
        단어가 있는 단어장이 없어요.
      </div>
    );
  }

  // 저장된 id 중 지워졌거나 비게 된 단어장은 data에 없으니 자연히 빠진다.
  const shown = new Set(selected ?? defaultIds(data));
  // data는 암기율 높은 순이다. 거르기만 하니 순서가 그대로 남는다.
  const rows = data.filter((row) => shown.has(row.id));

  function toggle(id: string) {
    const next = new Set(shown);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // 지금 보이는 단어장들의 순서대로 남긴다.
    const ids = data.map((row) => row.id).filter((rowId) => next.has(rowId));
    setSelected(ids);
    saveSelected(ids);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-ink">단어장별 암기율</h3>
        <div className="flex items-center gap-3.5">
          {(
            [
              ["bar", "막대"],
              ["curve", "곡선"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setView(key)}
              className={cn(
                "text-xs transition",
                view === key
                  ? "font-semibold text-ink"
                  : "font-medium text-umber/45 hover:text-umber/70",
              )}
            >
              {label}
            </button>
          ))}
          <SubtleButton
            className="py-1 text-xs"
            aria-expanded={picking}
            onClick={() => setPicking((open) => !open)}
          >
            {picking ? "완료" : "단어장 고르기"}
          </SubtleButton>
        </div>
      </div>

      {picking ? (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {data.map((row) => (
            <label
              key={row.id}
              className="flex items-center gap-1.5 text-xs text-ink/70"
            >
              <input
                type="checkbox"
                checked={shown.has(row.id)}
                onChange={() => toggle(row.id)}
                className="accent-ink"
              />
              {row.title}
            </label>
          ))}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-6 text-center text-sm text-umber/40">
          고른 단어장이 없어요.
        </p>
      ) : view === "bar" ? (
        <BarView rows={rows} />
      ) : (
        <CurveView rows={rows} />
      )}
    </div>
  );
}

function BarView({ rows }: { rows: MasteryRow[] }) {
  return (
    <ul className="mt-5 space-y-5" aria-label="단어장별 암기율 비교">
      {rows.map((row) => (
        <li
          key={row.id}
          title={`${row.title} — ${row.rate}% (${row.itemCount}개)`}
          className="flex items-center gap-3"
        >
          <span className="w-24 shrink-0 truncate text-xs text-ink/70 sm:w-36">
            {row.title}
          </span>
          {/* 50% 기준선 — 상한이 정해진 값이라 눈금이 고정이다 */}
          <div className="relative h-[10px] min-w-0 flex-1 rounded-full bg-taupe/30">
            <div className="absolute inset-y-[-3px] left-1/2 w-px bg-taupe/40" />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-chart-1/85"
              style={{ width: `max(${row.rate}%, 2px)` }}
            />
          </div>
          <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-ink">
            {row.rate}%
          </span>
          <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-umber/45">
            {row.itemCount}개
          </span>
        </li>
      ))}
      {/* 0 / 50 / 100 눈금. 막대와 같은 칸 구성이라 위치가 맞는다. */}
      <li aria-hidden className="flex items-center gap-3">
        <span className="w-24 shrink-0 sm:w-36" />
        <div className="relative h-3 min-w-0 flex-1 text-[10px] tabular-nums text-umber/42">
          <span className="absolute left-0">0</span>
          <span className="absolute left-1/2 -translate-x-1/2">50</span>
          <span className="absolute right-0">100</span>
        </div>
        <span className="w-9 shrink-0" />
        <span className="w-12 shrink-0" />
      </li>
    </ul>
  );
}

const CURVE_HEIGHT = 200;
const PAD_LEFT = 34;
const PAD_RIGHT = 12;
const PAD_TOP = 14;
const PAD_BOTTOM = 26;

// 사이트가 흑백이라 선은 진하기로 구분한다. 넷째부터는 점선을 얹는다.
const LINE_OPACITY = [0.85, 0.5, 0.28];

/** 축에 쓸 깔끔한 상한(%) — 10 단위로 올림, 최대 100. */
function percentCeil(value: number): number {
  return Math.min(100, Math.max(10, Math.ceil(value / 10) * 10));
}

/**
 * 점들을 부드럽게 잇는 경로. 단조 3차 보간(Fritsch–Carlson)이다.
 *
 * 그냥 베지어로 이으면 값이 0인 칸 근처에서 선이 0 아래로 내려가 "음수 카드"가
 * 있는 것처럼 보인다. 단조 보간은 이웃 점 사이를 넘어가지 않는다.
 */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  const n = points.length;
  const dx = points.slice(1).map((p, i) => p.x - points[i]!.x);
  const slope = points.slice(1).map((p, i) => (p.y - points[i]!.y) / dx[i]!);
  const tangent = points.map((_, i) => {
    if (i === 0) return slope[0]!;
    if (i === n - 1) return slope[n - 2]!;
    const a = slope[i - 1]!;
    const b = slope[i]!;
    return a * b <= 0
      ? 0
      : (3 * (dx[i - 1]! + dx[i]!)) /
          ((2 * dx[i]! + dx[i - 1]!) / a + (dx[i]! + 2 * dx[i - 1]!) / b);
  });

  let d = `M${points[0]!.x},${points[0]!.y}`;
  for (let i = 0; i < n - 1; i++) {
    const p = points[i]!;
    const q = points[i + 1]!;
    const h = dx[i]! / 3;
    d += ` C${p.x + h},${p.y + h * tangent[i]!} ${q.x - h},${q.y - h * tangent[i + 1]!} ${q.x},${q.y}`;
  }
  return d;
}

function CurveView({ rows }: { rows: MasteryRow[] }) {
  const [width, setWidth] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    // observe() 직후 한 번 호출되므로 초기값도 여기서 채워진다.
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 단어장마다 카드 수가 달라 개수로 그리면 큰 단어장만 보인다. 비율(%)로 그린다.
  // 서버가 아직 단계를 안 보내는 단어장은 뺀다.
  const lines = rows
    .filter((row) => row.stages.length === STAGE_LABELS.length)
    .map((row) => {
      const total = row.stages.reduce((sum, n) => sum + n, 0);
      return {
        ...row,
        percents: row.stages.map((n) => (total > 0 ? (n / total) * 100 : 0)),
      };
    });

  if (lines.length === 0) {
    return (
      <p className="mt-6 text-center text-sm text-umber/40">
        단계 정보를 아직 불러오지 못했어요.
      </p>
    );
  }

  const yMax = percentCeil(Math.max(...lines.flatMap((line) => line.percents)));
  const plotWidth = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const plotHeight = CURVE_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const baseY = PAD_TOP + plotHeight;
  const xAt = (i: number) =>
    PAD_LEFT + (plotWidth * i) / (STAGE_LABELS.length - 1);
  const yAt = (percent: number) => baseY - (percent / yMax) * plotHeight;

  return (
    <div className="mt-5">
      <div ref={boxRef}>
        <svg
          viewBox={`0 0 ${Math.max(width, 1)} ${CURVE_HEIGHT}`}
          width="100%"
          height={CURVE_HEIGHT}
          role="img"
          aria-label="단어장별 암기 단계 분포"
        >
          {/* 가로 그리드 + y축 라벨(%) */}
          {[0, yMax / 2, yMax].map((v) => (
            <g key={v}>
              <line
                x1={PAD_LEFT}
                x2={width - PAD_RIGHT}
                y1={yAt(v)}
                y2={yAt(v)}
                stroke="var(--nyaki-taupe)"
                strokeOpacity={v === 0 ? 0.45 : 0.18}
                strokeWidth={1}
              />
              <text
                x={PAD_LEFT - 8}
                y={yAt(v)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-umber/42 text-[10px] tabular-nums"
              >
                {Math.round(v)}%
              </text>
            </g>
          ))}

          {/* x축 — 단계 */}
          {STAGE_LABELS.map((label, i) => (
            <text
              key={label}
              x={xAt(i)}
              y={CURVE_HEIGHT - 6}
              textAnchor={
                i === 0
                  ? "start"
                  : i === STAGE_LABELS.length - 1
                    ? "end"
                    : "middle"
              }
              className="fill-umber/42 text-[10px]"
            >
              {label}
            </text>
          ))}

          {plotWidth > 0
            ? lines.map((line, index) => {
                const points = line.percents.map((p, i) => ({
                  x: xAt(i),
                  y: yAt(p),
                }));
                const opacity =
                  LINE_OPACITY[index % LINE_OPACITY.length] ?? LINE_OPACITY[0];
                return (
                  <g key={line.id}>
                    <title>{`${line.title} — ${STAGE_LABELS.map(
                      (label, i) =>
                        `${label} ${Math.round(line.percents[i]!)}%`,
                    ).join(" · ")}`}</title>
                    <path
                      d={smoothPath(points)}
                      fill="none"
                      stroke="var(--nyaki-ink)"
                      strokeOpacity={opacity}
                      strokeWidth={1.75}
                      strokeDasharray={
                        index >= LINE_OPACITY.length ? "4 3" : undefined
                      }
                      strokeLinecap="round"
                    />
                    {points.map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={2.25}
                        fill="var(--nyaki-ink)"
                        fillOpacity={opacity}
                      />
                    ))}
                  </g>
                );
              })
            : null}
        </svg>
      </div>

      {/* 범례 — 선 진하기와 이름을 잇는다 */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5" aria-label="범례">
        {lines.map((line, index) => (
          <li
            key={line.id}
            className="flex items-center gap-1.5 text-xs text-ink/70"
          >
            <svg width="16" height="6" aria-hidden>
              <line
                x1="0"
                x2="16"
                y1="3"
                y2="3"
                stroke="var(--nyaki-ink)"
                strokeOpacity={
                  LINE_OPACITY[index % LINE_OPACITY.length] ?? LINE_OPACITY[0]
                }
                strokeWidth={1.75}
                strokeDasharray={
                  index >= LINE_OPACITY.length ? "4 3" : undefined
                }
              />
            </svg>
            {line.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
