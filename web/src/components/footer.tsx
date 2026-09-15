import Link from "next/link";

const links = [
  { href: "/word-books", label: "내 단어장" },
  {
    href: "https://blog.naver.com/doidev",
    label: "블로그",
    external: true,
  },
] as const;

export function Footer() {
  return (
    <footer className="w-full bg-ink text-cream">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-14 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-tight">Nyaki</p>
          <p className="mt-2 max-w-xs text-sm text-cream/50">
            Nyaki 웹 단어 편집기
          </p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-cream/40">
            바로가기
          </p>
          <ul className="mt-3 space-y-2">
            {links.map((link) =>
              "external" in link && link.external ? (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-cream/70 transition hover:text-cream"
                  >
                    {link.label}
                  </a>
                </li>
              ) : (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-cream/70 transition hover:text-cream"
                  >
                    {link.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-cream/10 px-6 py-5 text-center text-xs text-cream/35">
        © {new Date().getFullYear()}
      </div>
    </footer>
  );
}
