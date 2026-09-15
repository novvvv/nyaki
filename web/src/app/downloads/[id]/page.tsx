"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { Badge, PageHeader, SubtleButton } from "@/components/ui";
import { getPack } from "@/lib/packs";

export default function PackDetailPage() {
  const params = useParams<{ id: string }>();
  const pack = getPack(params.id);

  if (!pack) {
    return (
      <main className="mx-auto w-full max-w-7xl px-8 py-14 lg:px-12">
        <PageHeader title="단어 묶음을 찾을 수 없습니다" />
        <Link href="/downloads" className="text-sm text-umber/55 hover:text-ink">
          단어 다운로드로 돌아가기
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-8 py-14 lg:px-12">
      <div className="mb-7 text-xs text-umber/40">
        <Link href="/downloads" className="transition-colors hover:text-ink">
          단어 다운로드
        </Link>
      </div>

      <PageHeader
        title={pack.title}
        description={`${pack.source} · ${pack.words.length}개 · ${pack.updatedAt} 업데이트`}
        actions={
          <div className="flex items-center gap-1.5">
            <SubtleButton className="py-1.5 text-xs">CSV</SubtleButton>
            <SubtleButton className="py-1.5 text-xs">
              내 단어장에 담기
            </SubtleButton>
          </div>
        }
      />

      <div className="mb-8 flex flex-wrap items-center gap-1.5">
        {pack.tags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>

      <ul className="divide-y divide-taupe/25 border-t border-taupe/25">
        {pack.words.map((word, index) => (
          <li
            key={word.term}
            className="flex items-center gap-6 py-3.5 text-sm"
          >
            <span className="w-8 shrink-0 text-xs tabular-nums text-ink/25">
              {index + 1}
            </span>
            <span className="w-40 shrink-0 font-medium text-ink">
              {word.term}
            </span>
            <span className="w-40 shrink-0 text-xs text-umber/45">
              {word.reading}
            </span>
            <span className="min-w-0 flex-1 truncate text-umber/70">
              {word.meaning}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
