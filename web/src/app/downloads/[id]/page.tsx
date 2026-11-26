"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { PackTile } from "@/components/pack-face";
import { Badge, PageHeader, SubtleButton } from "@/components/ui";
import { pictureWords, WordCard } from "@/components/word-card";
import { deckOf, type Deck, getDeck, getPack, LEVEL_TONE } from "@/lib/packs";
import { cn } from "@/lib/utils";
import { useVocab } from "@/lib/vocab-store";

/** 덱 — 안의 팩들을 나란히 보여 준다. 덱 자체는 담지 않는다. */
function DeckView({ deck }: { deck: Deck }) {
  const { packImports } = useVocab();
  const importedPackIds = new Set(packImports.map((record) => record.packId));
  const count = deck.packs.reduce((sum, pack) => sum + pack.words.length, 0);
  return (
    <main className="mx-auto w-full max-w-4xl break-keep px-8 py-14 lg:px-12">
      <div className="mb-7 text-xs text-umber/40">
        <Link href="/downloads" className="transition-colors hover:text-ink">
          단어 다운로드
        </Link>
      </div>
      <PageHeader
        title={deck.title}
        description={`${deck.source} · ${count}자 · ${deck.packs.length}개 팩 · ${deck.updatedAt} 업데이트`}
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {deck.packs.map((pack) => (
          <PackTile
            key={pack.id}
            pack={pack}
            imported={importedPackIds.has(pack.id)}
          />
        ))}
      </div>
    </main>
  );
}

export default function DownloadDetailPage() {
  const params = useParams<{ id: string }>();
  const deck = getDeck(params.id);
  return deck ? <DeckView deck={deck} /> : <PackView id={params.id} />;
}

function PackView({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const pack = getPack(id);
  const deck = deckOf(id);
  // 로그인 전에 담기를 누르면 바로 넘기지 않고 안내부터 한다 — 둘러보던 흐름을
  // 끊지 않고, 로그인할지는 사용자가 고른다.
  const [loginHint, setLoginHint] = useState(false);

  if (!pack) {
    return (
      <main className="mx-auto w-full max-w-7xl px-8 py-14 lg:px-12">
        <PageHeader title="단어 묶음을 찾을 수 없습니다" />
        <Link
          href="/downloads"
          className="text-sm text-umber/55 hover:text-ink"
        >
          단어 다운로드로 돌아가기
        </Link>
      </main>
    );
  }

  // 그림이 있는 단어는 카드로, 없는 단어는 예전처럼 줄로 보여 준다.
  const cards = pictureWords(pack.words);
  const plain = pack.words.filter((word) => !word.image);

  return (
    <main className="mx-auto w-full max-w-7xl px-8 py-14 lg:px-12">
      <div className="mb-7 text-xs text-umber/40">
        <Link href="/downloads" className="transition-colors hover:text-ink">
          단어 다운로드
        </Link>
        {deck ? (
          <>
            <span className="mx-1.5">/</span>
            <Link
              href={`/downloads/${deck.id}`}
              className="transition-colors hover:text-ink"
            >
              {deck.title}
            </Link>
          </>
        ) : null}
      </div>

      <PageHeader
        title={pack.title}
        description={`${pack.source} · ${pack.words.length}개 · ${pack.updatedAt} 업데이트`}
        actions={
          <div className="flex flex-col items-end gap-1.5">
            <SubtleButton
              className="py-1.5 text-xs"
              onClick={() => {
                if (user) router.push(`/downloads/${pack.id}/save`);
                else setLoginHint(true);
              }}
            >
              내 단어장에 담기
            </SubtleButton>
            {loginHint ? (
              <p className="text-xs text-umber/45">
                로그인 후 이용할 수 있어요.{" "}
                {/* 로그인을 마치면 담기 화면으로 바로 돌아온다. */}
                <Link
                  href={`/login?next=${encodeURIComponent(
                    `/downloads/${pack.id}/save`,
                  )}`}
                  className="text-ink/60 underline decoration-taupe/50 underline-offset-2 transition hover:text-ink"
                >
                  로그인 →
                </Link>
              </p>
            ) : null}
          </div>
        }
      />

      <div className="mb-8 flex flex-wrap items-center gap-1.5">
        {pack.tags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>

      {cards.length > 0 ? (
        <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
          {cards.map((word, index) => (
            <WordCard key={word.term} word={word} no={index + 1} />
          ))}
        </div>
      ) : null}

      {plain.length > 0 ? (
        <ul className="divide-y divide-taupe/25 border-t border-taupe/25">
          {plain.map((word, index) => (
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
              <span className="min-w-0 flex-1">
                <span className="block truncate text-umber/70">
                  {word.meaning}
                </span>
                {word.example ? (
                  <span className="mt-0.5 block truncate text-xs text-umber/40">
                    {word.example}
                  </span>
                ) : null}
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
      ) : null}
    </main>
  );
}
