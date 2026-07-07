"use client";

import { useEffect, useState, type ChangeEvent } from "react";

interface StructureExample {
  id: string;
  filename: string;
}

export function StructureExamplesSection({ profileId }: { profileId: string }) {
  const [examples, setExamples] = useState<StructureExample[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch(`/api/config-profiles/${profileId}/examples`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setExamples)
      .catch(() => setExamples([]));
  }

  useEffect(load, [profileId]);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setUploading(true);

    const content = await file.text();

    const res = await fetch(`/api/config-profiles/${profileId}/examples`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, content }),
    });

    setUploading(false);

    if (!res.ok) {
      setError("Não deu para enviar esse arquivo. Confira se é .md ou .txt e se o limite de 5 não foi atingido.");
      return;
    }

    load();
  }

  async function handleDelete(exampleId: string) {
    setError(null);
    const res = await fetch(`/api/config-profiles/${profileId}/examples/${exampleId}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Não deu para remover esse exemplo.");
      return;
    }
    load();
  }

  const atLimit = (examples?.length ?? 0) >= 5;

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
      <div className="field-label" style={{ marginBottom: 10 }}>
        Exemplos de estrutura ({examples?.length ?? 0}/5)
      </div>

      {examples && examples.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {examples.map((example) => (
            <div
              key={example.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}
            >
              <span style={{ color: "var(--ink-soft)" }}>{example.filename}</span>
              <button
                onClick={() => handleDelete(example.id)}
                style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12, padding: 0 }}
              >
                remover
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <div style={{ color: "#a13a3a", fontSize: 12, marginBottom: 8 }}>{error}</div>}

      <label
        className="btn btn--ghost"
        style={{
          width: "100%",
          fontSize: 12.5,
          padding: "9px 16px",
          opacity: atLimit || uploading ? 0.5 : 1,
          pointerEvents: atLimit || uploading ? "none" : "auto",
        }}
      >
        {uploading ? "Enviando…" : atLimit ? "Limite atingido" : "+ Anexar exemplo (.md/.txt)"}
        <input type="file" accept=".md,.txt" onChange={handleFile} style={{ display: "none" }} />
      </label>
    </div>
  );
}
