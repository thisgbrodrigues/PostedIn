"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AvatarGlyph, EmptyState, SectionLabel } from "@/components/ui";

interface ConfigProfile {
  id: string;
  name: string;
  niche: string;
  objective: string;
  toneOfVoice: Record<string, unknown>;
  template: Record<string, unknown>;
}

export default function PerfisPage() {
  const [profiles, setProfiles] = useState<ConfigProfile[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [objective, setObjective] = useState("");
  const [tone, setTone] = useState("");
  const [template, setTemplate] = useState("");

  function load() {
    fetch("/api/config-profiles")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setProfiles)
      .catch(() => setProfiles([]));
  }

  useEffect(load, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/config-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        niche,
        objective,
        toneOfVoice: tone.trim() ? { descricao: tone.trim() } : {},
        template: template.trim() ? { formato: template.trim() } : {},
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      setError("Não deu para salvar o perfil. Confira os campos obrigatórios.");
      return;
    }

    setName("");
    setNiche("");
    setObjective("");
    setTone("");
    setTemplate("");
    setShowForm(false);
    load();
  }

  return (
    <main>
      <div
        className="rise"
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 32,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="pill-badge pill-badge--ink" style={{ marginBottom: 14 }}>
            <span className="badge-dot" />
            Config Layer
          </span>
          <h1 style={{ fontSize: 38, marginTop: 14 }}>Perfis de voz</h1>
          <p style={{ color: "var(--ink-soft)", marginTop: 8, maxWidth: 480 }}>
            Cada perfil guarda o tom, o nicho, o objetivo e o template que o
            Redator e o Revisor vão seguir ao gerar um post.
          </p>
        </div>
        <button
          className="btn btn--lavender"
          onClick={() => setShowForm((s) => !s)}
        >
          {showForm ? "Cancelar" : "+ Criar perfil"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="card rise"
          style={{ padding: 28, marginBottom: 36 }}
        >
          <div
            className="form-grid-2"
            style={{
              marginBottom: 20,
            }}
          >
            <div>
              <label className="field-label">Nome do perfil</label>
              <input
                className="field-input"
                placeholder="Ex.: Voz de DevOps"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label">Nicho</label>
              <input
                className="field-input"
                placeholder="Ex.: devops, marketing, direito"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="field-label">Objetivo</label>
            <input
              className="field-input"
              placeholder="Ex.: gerar autoridade, gerar leads"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              required
            />
          </div>

          <div
            className="form-grid-2"
            style={{
              marginBottom: 24,
            }}
          >
            <div>
              <label className="field-label">Tom de voz (opcional)</label>
              <textarea
                className="field-input"
                rows={3}
                placeholder="Ex.: direto, com humor seco, sem jargão corporativo"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Template / estrutura (opcional)</label>
              <textarea
                className="field-input"
                rows={3}
                placeholder="Ex.: storytelling curto, lista de 3 pontos, contraste"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div style={{ color: "#a13a3a", fontSize: 13.5, marginBottom: 16 }}>{error}</div>
          )}

          <button className="btn btn--ink" type="submit" disabled={submitting}>
            {submitting ? "Salvando…" : "Salvar perfil"}
          </button>
        </form>
      )}

      <SectionLabel>Todos os perfis</SectionLabel>

      {profiles === null && (
        <div style={{ color: "var(--muted)", fontSize: 13.5 }}>Carregando…</div>
      )}

      {profiles && profiles.length === 0 && (
        <EmptyState
          title="Nenhum perfil ainda"
          subtitle="Crie o primeiro perfil para liberar o gerador de posts."
        />
      )}

      {profiles && profiles.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {profiles.map((profile, i) => (
            <div key={profile.id} className="card" style={{ padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <AvatarGlyph
                  letter={profile.name.charAt(0)}
                  tone={i % 2 === 0 ? "lavender" : "citrus"}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{profile.name}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{profile.niche}</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 18 }}>
                {profile.objective}
              </div>
              <a href={`/gerar?perfil=${profile.id}`} className="btn btn--ghost" style={{ width: "100%" }}>
                Gerar com este perfil
              </a>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
