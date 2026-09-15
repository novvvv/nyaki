"use client";

import { useAuth } from "@/components/auth-provider";
import { Card, PageHeader, SubtleButton } from "@/components/ui";
import { bookMeta, useVocab } from "@/lib/vocab-store";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="bg-card">
      <p className="text-xs text-umber/45">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-ink">
        {value}
      </p>
    </Card>
  );
}

function Row({
  label,
  value,
  action,
}: {
  label: string;
  value: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm text-ink">{label}</p>
        <p className="mt-0.5 truncate text-xs text-umber/45">{value}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export default function MyPage() {
  const { user, signOutUser } = useAuth();
  const { wordBooks } = useVocab();

  const wordCount = wordBooks.reduce(
    (sum, book) => sum + bookMeta(book).count,
    0,
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-8 py-14 lg:px-12">
      <PageHeader title="마이페이지" />

      <div className="mb-10 flex items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-subtle text-lg font-semibold text-ink/40">
          {user?.photoURL ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={user.photoURL}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            (user?.displayName ?? user?.email ?? "?").charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {user?.displayName ?? "이름 없음"}
          </p>
          <p className="mt-0.5 truncate text-xs text-umber/45">
            {user?.email ?? "—"}
          </p>
        </div>
      </div>

      <div className="mb-12 grid gap-4 sm:grid-cols-2">
        <Stat label="단어장" value={`${wordBooks.length}`} />
        <Stat label="모은 단어" value={`${wordCount}`} />
      </div>

      <section>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-ink/35">
          계정
        </p>
        <div className="divide-y divide-taupe/25">
          <Row
            label="로그아웃"
            value="이 기기에서 로그아웃합니다"
            action={
              <SubtleButton
                className="py-1.5 text-xs"
                onClick={() => void signOutUser()}
              >
                로그아웃
              </SubtleButton>
            }
          />
          <Row
            label="회원 탈퇴"
            value="모든 단어장이 삭제됩니다"
            action={
              <SubtleButton className="py-1.5 text-xs" disabled>
                탈퇴
              </SubtleButton>
            }
          />
        </div>
      </section>
    </main>
  );
}
