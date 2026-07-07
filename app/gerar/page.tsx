"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AvatarGlyph, EmptyState, Spinner, StageChip, stageLabel } from "@/components/ui";
import { SunburstMark } from "@/components/Logo";

interface ConfigProfile {
  id: string;
  name: string;
  niche: string;
  objective: string;
}

interface Fact {
  claim: string;
  sources: { title: string; url: string }[];
  confidence: "high" | "low";
}

interface PipelineTrace {
  theme?: string;
  themeRationale?: string;
  facts?: Fact[];
  thesis?: string;
  pov?: string;
  draft?: string;
  finalPost?: string;
  hookVariations?: string[];
  reviewNotes?: string[];
  reviewPassed?: boolean;
}

interface PipelineResult {
  executionId: string;
  finalPost: string;
  hookVariations: string[];
  trace: PipelineTrace;
}

interface PipelineFailure {
  executionId?: string;
  error: string;
  failedStage?: string;
}

const LOADING_STAGES = ["theme", "research", "angle", "writer", "hook", "reviewer"];

export default function GerarPage() {
  return (
    <Suspense fallback={null}>
      <GerarContent />
    </Suspense>
  );
}

function GerarContent() {
  const params = useSearchParams();
  const preselected = params.get("perfil");

  const [profiles, setProfiles] = useState<ConfigProfile[] | null>(null);
  const [profileId, setProfileId] = useState<string | null>(preselected);
  const [theme, setTheme] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStageIdx, setLoadingStageIdx] = useState(0);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [failure, setFailure] = useState<PipelineFailure | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config-profiles")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setProfiles)
      .catch(() => setProfiles([]));
  }, []);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => {
      setLoadingStageIdx((i) => (i + 1) % LOADING_STAGES.length);
    }, 2200);
    return () => clearInterval(id);
  }, [loading]);

  const selectedProfile = useMemo(
    () => profiles?.find((p) => p.id === profileId) ?? null,
    [profiles, profileId]
  );

  async function handleGenerate() {
    if (!profileId) return;
    setLoading(true);
    setLoadingStageIdx(0);
    setResult(null);
    setFailure(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configProfileId: profileId,
          theme: theme.trim() || undefined,
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        setFailure(body as PipelineFailure);
      } else {
        setResult(body as PipelineResult);
      }
    } catch {
      setFailure({ error: "Não foi possível falar com o servidor. Tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  function copy(key: string, text: string) {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 1600);
      })
      .catch(() => {
        // Clipboard permission denied or unavailable — fail silently,
        // the text is still selectable/copyable by hand.
      });
  }

  return (
    <main>
      <div className="rise" style={{ marginBottom: 32 }}>
        <span className="pill-badge pill-badge--ink" style={{ marginBottom: 14 }}>
          <span className="badge-dot" />
          Orquestrador
        </span>
        <h1 style={{ fontSize: 38, marginTop: 14 }}>Gerar um post</h1>
        <p style={{ color: "var(--ink-soft)", marginTop: 8, maxWidth: 520 }}>
          Escolha um perfil, diga sobre o quê (ou deixe em branco), e o
          Redige roda os 6 estágios em sequência até entregar o post final.
        </p>
      </div>

      <div className="two-col-grid">
        <div className="card rise" style={{ padding: 26, animationDelay: "0.06s" }}>
          <label className="field-label">Perfil</label>

          {profiles === null && <div style={{ fontSize: 13.5, color: "var(--muted)" }}>Carregando…</div>}

          {profiles && profiles.length === 0 && (
            <EmptyState title="Sem perfis" subtitle="Crie um perfil de voz antes de gerar." />
          )}

          {profiles && profiles.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {profiles.map((profile, i) => (
                <button
                  key={profile.id}
                  onClick={() => setProfileId(profile.id)}
                  className={
                    "profile-select-card" +
                    (profile.id === profileId ? " profile-select-card--active" : "")
                  }
                >
                  <AvatarGlyph letter={profile.name.charAt(0)} tone={i % 2 === 0 ? "lavender" : "citrus"} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{profile.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {profile.niche} · {profile.objective}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <label className="field-label">Tema (opcional)</label>
          <textarea
            className="field-input"
            rows={4}
            placeholder="Ex.: por que times pequenos sofrem mais com downtime — ou deixe em branco para o Estrategista sugerir"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            style={{ marginBottom: 22 }}
          />

          <button
            className="btn btn--lavender"
            style={{ width: "100%" }}
            disabled={!profileId || loading}
            onClick={handleGenerate}
          >
            {loading ? (
              <>
                <Spinner size={15} /> Gerando…
              </>
            ) : (
              "Gerar post"
            )}
          </button>
        </div>

        <div>
          {!loading && !result && !failure && (
            <div
              className="card rise"
              style={{
                padding: "56px 32px",
                textAlign: "center",
                color: "var(--muted)",
                animationDelay: "0.12s",
              }}
            >
              <div
                className="icon-circle"
                style={{
                  width: 56,
                  height: 56,
                  background: "var(--lavender-pale)",
                  color: "var(--lavender-deep)",
                  margin: "0 auto 18px",
                }}
              >
                <SunburstMark size={26} />
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-soft)" }}>
                O resultado aparece aqui
              </div>
              <div style={{ fontSize: 13.5, marginTop: 6 }}>
                Escolha um perfil e clique em &quot;Gerar post&quot;.
              </div>
            </div>
          )}

          {loading && (
            <div className="card" style={{ padding: 30 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <span
                  className="icon-circle pulse-soft"
                  style={{ width: 34, height: 34, background: "var(--ink)", color: "var(--citrus)" }}
                >
                  <SunburstMark size={18} spin />
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                    {stageLabel(LOADING_STAGES[loadingStageIdx])}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    Rodando o pipeline — isso pode levar um tempinho.
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {LOADING_STAGES.map((s, i) => (
                  <StageChip key={s} stage={s} active={i <= loadingStageIdx} />
                ))}
              </div>
            </div>
          )}

          {failure && (
            <div
              className="card"
              style={{
                padding: 26,
                borderColor: "rgba(161,58,58,0.35)",
                background: "#fbf1f1",
              }}
            >
              <div style={{ fontWeight: 700, color: "#8a2f2f", marginBottom: 6 }}>
                {failure.failedStage
                  ? `Falhou no estágio: ${stageLabel(failure.failedStage)}`
                  : "Algo deu errado"}
              </div>
              <div style={{ fontSize: 13.5, color: "#8a2f2f" }}>{failure.error}</div>
              {failure.executionId && (
                <div style={{ fontSize: 11.5, color: "#a86868", marginTop: 10 }}>
                  execução {failure.executionId}
                </div>
              )}
            </div>
          )}

          {result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {result.trace.theme && (
                <Bubble delay={0}>
                  <BubbleHeader stage="theme" />
                  <p style={{ fontSize: 14.5, fontWeight: 600 }}>{result.trace.theme}</p>
                  {result.trace.themeRationale && (
                    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                      {result.trace.themeRationale}
                    </p>
                  )}
                </Bubble>
              )}

              {result.trace.facts && result.trace.facts.length > 0 && (
                <Bubble delay={0.1} tone="citrus">
                  <BubbleHeader stage="research" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {result.trace.facts.map((fact, i) => (
                      <div key={i} style={{ fontSize: 13.5 }}>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            color: fact.confidence === "high" ? "var(--citrus-ink)" : "var(--muted)",
                            marginRight: 6,
                          }}
                        >
                          {fact.confidence === "high" ? "● confiável" : "○ verificar"}
                        </span>
                        {fact.claim}
                      </div>
                    ))}
                  </div>
                </Bubble>
              )}

              {result.trace.thesis && (
                <Bubble delay={0.2}>
                  <BubbleHeader stage="angle" />
                  <p style={{ fontSize: 14.5, fontWeight: 600 }}>{result.trace.thesis}</p>
                  {result.trace.pov && (
                    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                      {result.trace.pov}
                    </p>
                  )}
                </Bubble>
              )}

              {result.trace.draft && (
                <Bubble delay={0.3}>
                  <BubbleHeader stage="writer" done />
                </Bubble>
              )}

              <div
                className="card"
                style={{
                  padding: 26,
                  background: "var(--ink)",
                  color: "var(--surface)",
                  animation: "bubble-in 0.5s cubic-bezier(0.2,0.7,0.2,1) both",
                  animationDelay: "0.42s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span className="pill-badge" style={{ background: "var(--citrus)", color: "var(--citrus-ink)" }}>
                    Post pronto
                  </span>
                  <button
                    className="chip-copy"
                    style={{ background: "transparent", borderColor: "rgba(255,255,255,0.25)", color: "var(--surface)" }}
                    onClick={() => copy("post", result.finalPost)}
                  >
                    {copiedKey === "post" ? "Copiado ✓" : "Copiar texto"}
                  </button>
                </div>
                <p style={{ fontSize: 15, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                  {result.finalPost}
                </p>

                {result.trace.reviewNotes && result.trace.reviewNotes.length > 0 && (
                  <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.14)" }}>
                    <div style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.6, marginBottom: 8 }}>
                      Notas do Revisor {result.trace.reviewPassed ? "· aprovado" : "· revisar antes de publicar"}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, opacity: 0.8 }}>
                      {result.trace.reviewNotes.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {result.hookVariations.length > 0 && (
                <Bubble delay={0.5}>
                  <BubbleHeader stage="hook" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {result.hookVariations.map((hook, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 14px",
                          borderRadius: "var(--radius-md)",
                          background: "var(--lavender-pale)",
                        }}
                      >
                        <span style={{ fontSize: 13, color: "var(--lavender-ink)" }}>{hook}</span>
                        <button className="chip-copy" onClick={() => copy(`hook-${i}`, hook)}>
                          {copiedKey === `hook-${i}` ? "✓" : "Copiar"}
                        </button>
                      </div>
                    ))}
                  </div>
                </Bubble>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Bubble({
  children,
  delay = 0,
  tone,
}: {
  children: React.ReactNode;
  delay?: number;
  tone?: "citrus";
}) {
  return (
    <div
      className="card"
      style={{
        padding: 20,
        background: tone === "citrus" ? "var(--citrus-pale)" : "var(--surface)",
        animation: "bubble-in 0.5s cubic-bezier(0.2,0.7,0.2,1) both",
        animationDelay: `${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

function BubbleHeader({ stage, done }: { stage: string; done?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: done ? 0 : 8 }}>
      <span
        className="icon-circle"
        style={{ width: 22, height: 22, background: "var(--ink)", color: "var(--citrus)" }}
      >
        <SunburstMark size={12} />
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)" }}>
        {stageLabel(stage)} {done && "· concluído ✓"}
      </span>
    </div>
  );
}
