"use client";

import { useEffect, useState } from "react";
import { AvatarGlyph, EmptyState, SectionLabel, StageChip, Tile } from "@/components/ui";
import { SunburstMark } from "@/components/Logo";

interface ConfigProfile {
  id: string;
  name: string;
  niche: string;
  objective: string;
}

const STAGES = ["theme", "research", "angle", "writer", "hook", "reviewer"];

export default function Home() {
  const [profiles, setProfiles] = useState<ConfigProfile[] | null>(null);

  useEffect(() => {
    fetch("/api/config-profiles")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setProfiles)
      .catch(() => setProfiles([]));
  }, []);

  return (
    <main>
      <section
        className="rise hero-grid"
        style={{
          marginBottom: 48,
        }}
      >
        <div>
          <span className="pill-badge pill-badge--ink" style={{ marginBottom: 18 }}>
            <span className="badge-dot" />
            Config Layer · Orquestrador · 6 estágios
          </span>
          <h1
            style={{
              fontSize: "clamp(34px, 4.4vw, 54px)",
              lineHeight: 1.03,
              marginTop: 18,
              marginBottom: 18,
            }}
          >
            Hora de escrever
            <br />
            <em style={{ color: "var(--lavender-deep)", fontStyle: "italic" }}>algo bom.</em>
          </h1>
          <p style={{ fontSize: 16, color: "var(--ink-soft)", maxWidth: 440, marginBottom: 28 }}>
            Configure sua voz, escolha um tema — ou deixe o Redige sugerir um a
            partir do seu nicho — e acompanhe o post nascer, estágio por
            estágio.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href="/gerar" className="btn btn--ink">
              Gerar um post
            </a>
            <a href="/perfis" className="btn btn--ghost">
              Configurar perfis
            </a>
          </div>
        </div>

        <div
          style={{
            position: "relative",
            aspectRatio: "1 / 1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background:
                "conic-gradient(from 90deg, var(--lavender), var(--citrus), var(--lavender-pale), var(--lavender))",
              opacity: 0.55,
              filter: "blur(2px)",
            }}
          />
          <div
            className="card"
            style={{
              position: "relative",
              width: "72%",
              aspectRatio: "1 / 1",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--ink)",
              color: "var(--citrus)",
            }}
          >
            <SunburstMark size={54} spin />
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 48 }}>
        <div
          className="rise tiles-grid"
          style={{
            animationDelay: "0.08s",
          }}
        >
          <Tile
            href="/gerar"
            tone="lavender"
            title="Gerar novo post"
            subtitle="Rode o pipeline completo agora"
            icon={<SunburstMark size={20} />}
          />
          <Tile
            href="/perfis"
            tone="citrus"
            eyebrow="Novo"
            title="Criar perfil"
            subtitle="Tom, nicho, objetivo e template"
            icon={<PenIcon />}
          />
          <Tile
            href="/perfis"
            tone="ink"
            title="Perfis salvos"
            subtitle={`${profiles?.length ?? 0} configurados`}
            icon={<StackIcon />}
          />
        </div>
      </section>

      <section style={{ marginBottom: 48 }}>
        <SectionLabel>Como o pipeline funciona</SectionLabel>
        <div
          className="card rise"
          style={{
            padding: "22px 24px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            animationDelay: "0.16s",
          }}
        >
          {STAGES.map((stage, i) => (
            <span key={stage} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <StageChip stage={stage} active={i === 0} />
              {i < STAGES.length - 1 && (
                <span style={{ color: "var(--line-strong)", fontSize: 14 }}>→</span>
              )}
            </span>
          ))}
        </div>
      </section>

      <section>
        <SectionLabel action={<a href="/perfis" className="link-quiet">Ver todos</a>}>
          Perfis recentes
        </SectionLabel>

        {profiles === null && (
          <div style={{ color: "var(--muted)", fontSize: 13.5 }}>Carregando…</div>
        )}

        {profiles && profiles.length === 0 && (
          <EmptyState
            title="Nenhum perfil ainda"
            subtitle="Crie um perfil de voz para começar a gerar posts."
          />
        )}

        {profiles && profiles.length > 0 && (
          <div className="card" style={{ overflow: "hidden" }}>
            {profiles.slice(0, 5).map((profile, i) => (
              <a
                key={profile.id}
                href={`/gerar?perfil=${profile.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "16px 20px",
                  borderBottom:
                    i < Math.min(profiles.length, 5) - 1 ? "1px solid var(--line)" : "none",
                }}
              >
                <AvatarGlyph letter={profile.name.charAt(0)} tone={i % 2 === 0 ? "lavender" : "citrus"} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{profile.name}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                    {profile.niche} · {profile.objective}
                  </div>
                </div>
                <span className="link-quiet">Usar →</span>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function PenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8 4 20Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 3 3 8l9 5 9-5-9-5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M3 12l9 5 9-5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M3 16l9 5 9-5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
