import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Redige — gerador de posts para LinkedIn",
  description:
    "Config Layer + Orquestrador + pipeline de 6 estágios para gerar posts de LinkedIn com voz consistente.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${hanken.variable}`}>
      <body>
        <div className="bg-decor" />
        <div className="grain" />
        <div className="shell">
          <Nav />
          {children}
        </div>
      </body>
    </html>
  );
}
