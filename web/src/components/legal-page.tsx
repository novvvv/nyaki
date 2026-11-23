import Link from "next/link";
import type { ReactNode } from "react";

/** 약관 · 방침이 시행된 날. 고치면 함께 바꾼다. */
export const LEGAL_EFFECTIVE_DATE = "2026년 11월 20일";

/** 문의 창구. */
export const LEGAL_CONTACT = {
  label: "블로그(blog.naver.com/doidev)",
  href: "https://blog.naver.com/doidev",
};

/** 이용약관 · 개인정보처리방침이 같이 쓰는 읽기 좋은 문서 틀. */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl break-keep px-6 py-14 sm:py-20">
      <nav className="mb-8 flex gap-4 text-xs text-ink/40">
        <Link href="/terms" className="transition hover:text-ink">
          이용약관
        </Link>
        <Link href="/privacy" className="transition hover:text-ink">
          개인정보처리방침
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        {title}
      </h1>
      <p className="mt-2 text-xs text-ink/40">시행일 {LEGAL_EFFECTIVE_DATE}</p>
      <div className="mt-6 text-sm leading-relaxed text-ink/70">{intro}</div>
      <div className="mt-10 space-y-9">{children}</div>
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink/70 [&_li]:ml-4 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}

export function ContactLink() {
  return (
    <a
      href={LEGAL_CONTACT.href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-ink underline decoration-taupe/60 underline-offset-2"
    >
      {LEGAL_CONTACT.label}
    </a>
  );
}
