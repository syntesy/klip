"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, background: "#0f0f10", color: "#e5e5e7", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", padding: "0 24px" }}>
          <p style={{ fontSize: 36, marginBottom: 12 }}>⚠️</p>
          <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Algo deu errado</p>
          <p style={{ color: "#888", fontSize: 14, marginBottom: 24, maxWidth: 320 }}>
            Ocorreu um erro inesperado. Tente recarregar a página.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ background: "#1249A0", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
