// Pure display component — no "use client" needed

export interface KlipLogoProps {
  variant?: "full" | "mark" | "wordmark";
  size?: "sm" | "md" | "lg";
  theme?: "light" | "dark";
}

// ─── Size tokens ──────────────────────────────────────────────────────────────

const MARK_PX   = { sm: 24, md: 38, lg: 44 } as const;
const MARK_FS   = { sm: 11, md: 16, lg: 20 } as const;
const WORD_FS   = { sm: 14, md: 28, lg: 24 } as const;

// ─── Mark ─────────────────────────────────────────────────────────────────────

function Mark({ size }: { size: "sm" | "md" | "lg" }) {
  const px = MARK_PX[size];
  const fs = MARK_FS[size];

  return (
    <span
      role="img"
      aria-label="Klip logo mark"
      style={{
        display:         "inline-flex",
        alignItems:      "center",
        justifyContent:  "center",
        flexShrink:      0,
        width:           px,
        height:          px,
        borderRadius:    10,
        backgroundColor: "#1249A0",   // Anchor Blue — fixed in both themes
        boxShadow:       "0 2px 10px rgba(18,73,160,.28)",
      }}
    >
      <span
        style={{
          color:          "#FFFFFF",
          fontWeight:     600,
          fontSize:       fs,
          letterSpacing:  "-0.5px",
          lineHeight:     1,
          fontFamily:     "inherit",
          userSelect:     "none",
        }}
      >
        kl
      </span>
    </span>
  );
}

// ─── Wordmark ─────────────────────────────────────────────────────────────────

function Wordmark({
  size,
  theme,
}: {
  size: "sm" | "md" | "lg";
  theme: "light" | "dark";
}) {
  const fs = WORD_FS[size];
  // Use CSS variables — they automatically flip in dark mode via [data-theme="dark"]
  void theme; // prop kept for API compatibility

  return (
    <span
      aria-label="Klip"
      style={{
        fontSize:      fs,
        fontWeight:    700,
        letterSpacing: "-0.8px",
        lineHeight:    "38px",
        fontFamily:    "inherit",
        userSelect:    "none",
      }}
    >
      <span style={{ color: "var(--color-text-1)" }}>k</span>
      <span style={{ color: "var(--color-blue-bright)" }}>l</span>
      <span style={{ color: "var(--color-text-1)" }}>ip</span>
    </span>
  );
}

// ─── KlipLogo ─────────────────────────────────────────────────────────────────

export function KlipLogo({
  variant = "full",
  size    = "md",
  theme   = "light",
}: KlipLogoProps) {
  if (variant === "mark") {
    return <Mark size={size} />;
  }

  if (variant === "wordmark") {
    return <Wordmark size={size} theme={theme} />;
  }

  // variant === "full"
  return (
    <span
      style={{
        display:    "inline-flex",
        alignItems: "center",
        gap:        11,
      }}
    >
      <Mark size={size} />
      <Wordmark size={size} theme={theme} />
    </span>
  );
}
