import { KlipLogo } from "@/components/ui/KlipLogo";

// ─── Preview grid ─────────────────────────────────────────────────────────────

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color: "var(--color-text-3)",
          marginBottom: 16,
        }}
      >
        {label}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
        {children}
      </div>
    </section>
  );
}

function Cell({
  label,
  children,
  dark,
}: {
  label: string;
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
      <div
        style={{
          padding: "18px 24px",
          borderRadius: 12,
          backgroundColor: dark ? "#0B1628" : "#FFFFFF",
          border: dark ? "none" : "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 80,
        }}
      >
        {children}
      </div>
      <span
        style={{
          fontSize: 11,
          color: "var(--color-text-3)",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {label}
      </span>
    </div>
  );
}

export default function LogoPreviewPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-bg-page)",
        padding: "48px 40px",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: "var(--color-text-1)",
              margin: 0,
              marginBottom: 6,
            }}
          >
            KlipLogo — Componente
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-3)", margin: 0 }}>
            3 variantes · 3 tamanhos · 2 temas
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>

          {/* ── full, light ──────────────────────────────────────────────── */}
          <Section label='variant="full" · theme="light"'>
            <Cell label='size="sm"'>
              <KlipLogo variant="full" size="sm" theme="light" />
            </Cell>
            <Cell label='size="md" (default)'>
              <KlipLogo variant="full" size="md" theme="light" />
            </Cell>
            <Cell label='size="lg"'>
              <KlipLogo variant="full" size="lg" theme="light" />
            </Cell>
          </Section>

          {/* ── full, dark ───────────────────────────────────────────────── */}
          <Section label='variant="full" · theme="dark"'>
            <Cell label='size="sm"' dark>
              <KlipLogo variant="full" size="sm" theme="dark" />
            </Cell>
            <Cell label='size="md"' dark>
              <KlipLogo variant="full" size="md" theme="dark" />
            </Cell>
            <Cell label='size="lg"' dark>
              <KlipLogo variant="full" size="lg" theme="dark" />
            </Cell>
          </Section>

          {/* ── mark ─────────────────────────────────────────────────────── */}
          <Section label='variant="mark" · (theme ignorado — sempre Anchor Blue)'>
            <Cell label='size="sm"'>
              <KlipLogo variant="mark" size="sm" />
            </Cell>
            <Cell label='size="md"'>
              <KlipLogo variant="mark" size="md" />
            </Cell>
            <Cell label='size="lg"'>
              <KlipLogo variant="mark" size="lg" />
            </Cell>
            <Cell label='size="sm" · dark bg' dark>
              <KlipLogo variant="mark" size="sm" />
            </Cell>
            <Cell label='size="md" · dark bg' dark>
              <KlipLogo variant="mark" size="md" />
            </Cell>
            <Cell label='size="lg" · dark bg' dark>
              <KlipLogo variant="mark" size="lg" />
            </Cell>
          </Section>

          {/* ── wordmark ─────────────────────────────────────────────────── */}
          <Section label='variant="wordmark" · theme="light"'>
            <Cell label='size="sm"'>
              <KlipLogo variant="wordmark" size="sm" theme="light" />
            </Cell>
            <Cell label='size="md"'>
              <KlipLogo variant="wordmark" size="md" theme="light" />
            </Cell>
            <Cell label='size="lg"'>
              <KlipLogo variant="wordmark" size="lg" theme="light" />
            </Cell>
          </Section>

          <Section label='variant="wordmark" · theme="dark"'>
            <Cell label='size="sm"' dark>
              <KlipLogo variant="wordmark" size="sm" theme="dark" />
            </Cell>
            <Cell label='size="md"' dark>
              <KlipLogo variant="wordmark" size="md" theme="dark" />
            </Cell>
            <Cell label='size="lg"' dark>
              <KlipLogo variant="wordmark" size="lg" theme="dark" />
            </Cell>
          </Section>

          {/* ── Token reference ──────────────────────────────────────────── */}
          <Section label="Tokens usados">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
                width: "100%",
              }}
            >
              {[
                { name: "--color-blue",        value: "#1249A0", label: "Anchor Blue (mark bg)" },
                { name: "--color-blue-bright",  value: "#4A9EFF", label: "Signal Blue (\"l\")" },
                { name: "--color-text-1",       value: "#0F1923", label: "Text light theme" },
              ].map((token) => (
                <div
                  key={token.name}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 8,
                    backgroundColor: "#FFFFFF",
                    border: "1px solid var(--color-border)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      backgroundColor: token.value,
                      flexShrink: 0,
                      border: "1px solid rgba(0,0,0,0.08)",
                    }}
                  />
                  <div>
                    <p style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: "var(--color-text-2)", margin: 0, marginBottom: 2 }}>
                      {token.name}
                    </p>
                    <p style={{ fontSize: 10, color: "var(--color-text-3)", margin: 0 }}>
                      {token.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}
