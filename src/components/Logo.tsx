export function SunburstMark({ size = 22, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={spin ? "spin-slow" : undefined}
      aria-hidden
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <rect
          key={i}
          x="11"
          y="1"
          width="2"
          height="7"
          rx="1"
          fill="currentColor"
          transform={`rotate(${i * 45} 12 12)`}
        />
      ))}
    </svg>
  );
}

export function Wordmark() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--font-display)",
        fontSize: 19,
        fontWeight: 600,
        letterSpacing: "-0.02em",
        color: "var(--ink)",
      }}
    >
      <span
        className="icon-circle"
        style={{
          width: 30,
          height: 30,
          background: "var(--ink)",
          color: "var(--citrus)",
        }}
      >
        <SunburstMark size={16} />
      </span>
      Redige
    </span>
  );
}
