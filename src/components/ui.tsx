import type { ReactNode, CSSProperties } from "react";

export function Tile({
  href,
  tone,
  eyebrow,
  title,
  subtitle,
  icon,
  onClick,
}: {
  href?: string;
  tone: "lavender" | "citrus" | "ink";
  eyebrow?: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  const tones: Record<string, CSSProperties> = {
    lavender: { background: "var(--lavender)", color: "var(--lavender-ink)" },
    citrus: { background: "var(--citrus)", color: "var(--citrus-ink)" },
    ink: { background: "var(--ink)", color: "var(--surface)" },
  };

  const Comp = href ? "a" : "button";

  return (
    <Comp
      href={href}
      onClick={onClick}
      style={{
        ...tones[tone],
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 22,
        borderRadius: "var(--radius-lg)",
        padding: "22px 22px 24px",
        minHeight: 168,
        border: "none",
        textAlign: "left",
        position: "relative",
        overflow: "hidden",
        boxShadow: "var(--shadow-tight)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        width: "100%",
      }}
      className="tile-hover"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          className="icon-circle"
          style={{
            width: 40,
            height: 40,
            background: "rgba(255,255,255,0.4)",
          }}
        >
          {icon}
        </span>
        {eyebrow && (
          <span className="pill-badge pill-badge--coral">{eyebrow}</span>
        )}
      </div>
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: 13.5, opacity: 0.75, fontWeight: 500 }}>{subtitle}</div>
      </div>
    </Comp>
  );
}

export function SectionLabel({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
      }}
    >
      <h2 style={{ fontSize: 20 }}>{children}</h2>
      {action}
    </div>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="spin-slow"
      style={{ animationDuration: "0.8s" }}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="42 100"
        opacity="0.9"
      />
    </svg>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      className="card"
      style={{
        padding: "36px 28px",
        textAlign: "center",
        color: "var(--muted)",
      }}
    >
      <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-soft)", marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 13.5 }}>{subtitle}</div>
    </div>
  );
}

const STAGE_LABELS: Record<string, string> = {
  theme: "Estrategista de Tema",
  research: "Pesquisador",
  angle: "Definidor de Ângulo",
  writer: "Redator",
  hook: "Editor de Gancho",
  reviewer: "Revisor / Crítico",
};

export function stageLabel(stage: string) {
  return STAGE_LABELS[stage] ?? stage;
}

export function StageChip({ stage, active }: { stage: string; active?: boolean }) {
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 700,
        padding: "6px 12px",
        borderRadius: "var(--radius-pill)",
        background: active ? "var(--ink)" : "var(--surface)",
        color: active ? "var(--surface)" : "var(--muted)",
        border: active ? "none" : "1px solid var(--line)",
        whiteSpace: "nowrap",
        transition: "all 0.3s ease",
      }}
    >
      {stageLabel(stage)}
    </span>
  );
}

export function AvatarGlyph({ letter, tone }: { letter: string; tone: "lavender" | "citrus" }) {
  const bg = tone === "lavender" ? "var(--lavender-pale)" : "var(--citrus-pale)";
  const fg = tone === "lavender" ? "var(--lavender-deep)" : "var(--citrus-deep)";
  return (
    <span
      className="icon-circle"
      style={{
        width: 40,
        height: 40,
        background: bg,
        color: fg,
        fontFamily: "var(--font-display)",
        fontSize: 16,
        fontWeight: 600,
      }}
    >
      {letter.toUpperCase()}
    </span>
  );
}
