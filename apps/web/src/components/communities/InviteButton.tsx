"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

interface Props {
  communityId: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Tab = "link" | "qrcode";
type LinkStep = "idle" | "loading" | "ready" | "copied";
type QrStep = "idle" | "loading" | "ready" | "error";

export function InviteButton({ communityId, triggerStyle }: Props & { triggerStyle?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("link");

  // Link tab state
  const [linkStep, setLinkStep] = useState<LinkStep>("idle");
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  // QR tab state
  const [qrStep, setQrStep] = useState<QrStep>("idle");
  const [qrSvg, setQrSvg] = useState("");
  const [qrUrl, setQrUrl] = useState("");

  const { getToken } = useAuth();

  async function generateLink() {
    setLinkStep("loading");
    setLinkError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/invites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ communityId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setLinkError(body.error ?? "Erro ao gerar convite");
        setLinkStep("idle");
        return;
      }
      const data = await res.json() as { link: string };
      setLink(data.link);
      setLinkStep("ready");
    } catch {
      setLinkError("Erro de rede");
      setLinkStep("idle");
    }
  }

  async function loadQrCode() {
    setQrStep("loading");
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/communities/${communityId}/qrcode`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { setQrStep("error"); return; }
      const data = await res.json() as { svg: string; url: string };
      setQrSvg(data.svg);
      setQrUrl(data.url);
      setQrStep("ready");
    } catch {
      setQrStep("error");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setLinkStep("copied");
      setTimeout(() => setLinkStep("ready"), 2000);
    } catch { /* fallback */ }
  }

  function downloadQr() {
    const blob = new Blob([qrSvg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "qrcode-klip.svg";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function handleOpen() {
    setOpen(true);
    setTab("link");
    setLink("");
    setLinkStep("idle");
    setLinkError(null);
    setQrSvg("");
    setQrStep("idle");
    void generateLink();
  }

  // When switching to QR tab, load if not loaded yet
  useEffect(() => {
    if (open && tab === "qrcode" && qrStep === "idle") {
      void loadQrCode();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, open]);

  function handleClose() {
    setOpen(false);
  }

  const tabBase = "px-4 py-2 text-[13px] font-medium rounded-[8px] transition-colors";
  const tabActive = `${tabBase} bg-bg-subtle text-text-1`;
  const tabInactive = `${tabBase} text-text-3 hover:text-text-2`;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={triggerStyle ? undefined : "px-4 py-2 rounded-lg border border-border text-[13px] text-text-2 hover:bg-bg-subtle transition-colors font-medium"}
        style={triggerStyle}
      >
        Convidar
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <div className="bg-bg-surface rounded-2xl border border-border shadow-lg w-full max-w-md p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold text-text-1">Convidar pessoas</h2>
              <button type="button" onClick={handleClose}
                className="text-text-3 hover:text-text-2 text-lg leading-none">×</button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-5 p-1 rounded-[10px] bg-bg-subtle w-fit">
              <button type="button" className={tab === "link" ? tabActive : tabInactive}
                onClick={() => setTab("link")}>
                🔗 Link
              </button>
              <button type="button" className={tab === "qrcode" ? tabActive : tabInactive}
                onClick={() => setTab("qrcode")}>
                QR Code
              </button>
            </div>

            {/* ── Link tab ── */}
            {tab === "link" && (
              <div className="space-y-3">
                {linkStep === "loading" && (
                  <div className="flex items-center gap-2 text-[13px] text-text-3 py-4">
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-blue border-t-transparent rounded-full" />
                    Gerando link…
                  </div>
                )}

                {linkError && <p className="text-[12px] text-red-500 py-2">{linkError}</p>}

                {(linkStep === "ready" || linkStep === "copied") && (
                  <>
                    <p className="text-[13px] text-text-2">
                      Compartilhe este link. Quem clicar entra automaticamente na comunidade.
                    </p>
                    <div className="rounded-xl p-3 border"
                      style={{ background: "var(--color-blue-dim)", borderColor: "var(--color-blue-border)" }}>
                      <p className="text-[11px] font-medium text-text-3 mb-[6px] uppercase tracking-[0.06em]">
                        Link de convite
                      </p>
                      <p className="text-[13px] font-mono text-blue break-all leading-snug">{link}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyLink()}
                      className="w-full py-[10px] rounded-lg text-[13px] font-semibold transition-colors"
                      style={
                        linkStep === "copied"
                          ? { background: "var(--color-green-dim)", border: "1px solid var(--color-green-border)", color: "var(--color-green)" }
                          : { background: "var(--color-blue)", color: "#fff" }
                      }
                    >
                      {linkStep === "copied" ? "Copiado ✓" : "Copiar link"}
                    </button>
                    <p className="text-[11px] text-text-3 text-center">
                      O link não expira e pode ser usado por qualquer pessoa.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* ── QR Code tab ── */}
            {tab === "qrcode" && (
              <div className="flex flex-col items-center gap-4">
                {qrStep === "loading" && (
                  <div className="flex items-center gap-2 text-[13px] text-text-3 py-8">
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-blue border-t-transparent rounded-full" />
                    Gerando QR Code…
                  </div>
                )}

                {qrStep === "error" && (
                  <p className="text-[12px] text-red-500 py-4">Erro ao gerar QR Code.</p>
                )}

                {qrStep === "ready" && (
                  <>
                    {/* SVG as data URI — avoids dangerouslySetInnerHTML XSS vector */}
                    <div className="rounded-[12px] p-3 border border-border bg-white"
                      style={{ width: 224, height: 224 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(qrSvg)))}`}
                        alt="QR Code de convite"
                        width={200}
                        height={200}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={downloadQr}
                      className="flex items-center gap-2 px-5 py-[9px] rounded-[8px] text-[13px] font-semibold text-white bg-blue hover:opacity-90 transition-opacity"
                    >
                      ⬇ Baixar QR Code
                    </button>

                    <p className="text-[12px] text-text-3 text-center max-w-[260px]">
                      Mostre este QR Code para novos membros entrarem diretamente
                    </p>

                    <p className="text-[11px] font-mono text-text-3 break-all text-center">{qrUrl}</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
