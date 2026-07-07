"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./Logo";

const LINKS = [
  { href: "/", label: "Início" },
  { href: "/perfis", label: "Perfis" },
  { href: "/gerar", label: "Gerar post" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header
      className="rise"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 40,
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <Link href="/">
        <Wordmark />
      </Link>

      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-pill)",
          padding: 5,
          boxShadow: "var(--shadow-tight)",
        }}
      >
        {LINKS.map((link) => {
          const active =
            link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                padding: "9px 18px",
                borderRadius: "var(--radius-pill)",
                fontSize: 13.5,
                fontWeight: 600,
                background: active ? "var(--ink)" : "transparent",
                color: active ? "var(--surface)" : "var(--ink-soft)",
                transition: "background 0.16s ease, color 0.16s ease",
              }}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
