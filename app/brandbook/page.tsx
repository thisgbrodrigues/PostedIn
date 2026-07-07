"use client";

import { useEffect, useState, type FormEvent } from "react";

interface Brandbook {
  id: string;
  name: string;
  role: string;
  company: string;
  industry: string;
  bio: string;
  values: string;
  voiceReferences: string;
}

export default function BrandbookPage() {
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("");
  const [bio, setBio] = useState("");
  const [values, setValues] = useState("");
  const [voiceReferences, setVoiceReferences] = useState("");

  useEffect(() => {
    fetch("/api/brandbook")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((brandbook: Brandbook | null) => {
        if (brandbook) {
          setName(brandbook.name);
          setRole(brandbook.role);
          setCompany(brandbook.company);
          setIndustry(brandbook.industry);
          setBio(brandbook.bio);
          setValues(brandbook.values);
          setVoiceReferences(brandbook.voiceReferences);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/brandbook", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role, company, industry, bio, values, voiceReferences }),
    });

    setSaving(false);

    if (!res.ok) {
      setError("Não deu para salvar o Brandbook. Confira os campos obrigatórios.");
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  if (!loaded) {
    return (
      <main>
        <div style={{ color: "var(--muted)", fontSize: 13.5 }}>Carregando…</div>
      </main>
    );
  }

  return (
    <main>
      <div className="rise" style={{ marginBottom: 32 }}>
        <span className="pill-badge pill-badge--ink" style={{ marginBottom: 14 }}>
          <span className="badge-dot" />
          Config Layer
        </span>
        <h1 style={{ fontSize: 38, marginTop: 14 }}>Brandbook</h1>
        <p style={{ color: "var(--ink-soft)", marginTop: 8, maxWidth: 520 }}>
          A identidade de quem produz os posts. Todos os perfis de voz usam
          esse mesmo Brandbook para moldar estrutura e tom.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card rise" style={{ padding: 28, maxWidth: 640 }}>
        <div className="form-grid-2" style={{ marginBottom: 20 }}>
          <div>
            <label className="field-label">Nome</label>
            <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="field-label">Cargo</label>
            <input className="field-input" value={role} onChange={(e) => setRole(e.target.value)} required />
          </div>
        </div>

        <div className="form-grid-2" style={{ marginBottom: 20 }}>
          <div>
            <label className="field-label">Empresa</label>
            <input className="field-input" value={company} onChange={(e) => setCompany(e.target.value)} required />
          </div>
          <div>
            <label className="field-label">Setor</label>
            <input className="field-input" value={industry} onChange={(e) => setIndustry(e.target.value)} required />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label className="field-label">Biografia e trajetória</label>
          <textarea className="field-input" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label className="field-label">Valores e posicionamento</label>
          <textarea className="field-input" rows={3} value={values} onChange={(e) => setValues(e.target.value)} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label className="field-label">Referências de voz</label>
          <textarea
            className="field-input"
            rows={2}
            placeholder="Expressões recorrentes, hashtags, frases de assinatura"
            value={voiceReferences}
            onChange={(e) => setVoiceReferences(e.target.value)}
          />
        </div>

        {error && <div style={{ color: "#a13a3a", fontSize: 13.5, marginBottom: 16 }}>{error}</div>}

        <button className="btn btn--ink" type="submit" disabled={saving}>
          {saving ? "Salvando…" : saved ? "Salvo ✓" : "Salvar Brandbook"}
        </button>
      </form>
    </main>
  );
}
