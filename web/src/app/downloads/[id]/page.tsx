"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { Badge, PageHeader, SubtleButton } from "@/components/ui";
import { getPack, LEVEL_TONE } from "@/lib/packs";
import { cn } from "@/lib/utils";
import { useVocab } from "@/lib/vocab-store";

export default function PackDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const pack = getPack(params.id);
  const { wordBooks, packImports } = useVocab();

  // 이 묶음을 담은 단어장 이름. 지운 단어장은 서버가 이미 뺐다.
  const importedInto = packImports
    .filter((record) => record.packId === pack?.id)
    .map((record) => wordBooks.find((book) => book.id === record.wordBookId))
    .filter((book) => book !== undefined)
    .map((book) => `「${book.title}」`);

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
          <SubtleButton
            className="py-1.5 text-xs"
            onClick={() => router.push(`/downloads/${pack.id}/save`)}
          >
            내 단어장에 담기
          </SubtleButton>
        }
      />

      <div className="mb-8 flex flex-wrap items-center gap-1.5">
        {pack.tags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
        {importedInto.length > 0 ? (
          <span className="text-xs text-umber/55">
            이미 {importedInto.join(", ")}에 담았어요
          </span>
        ) : null}
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
            <span className="w-8 shrink-0 text-right">
              {word.level ? (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                    LEVEL_TONE[word.level],
                  )}
                >
                  {word.level}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
