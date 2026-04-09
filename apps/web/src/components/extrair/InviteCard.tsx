"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface InviteCardData {
  impressionId: string;
  extractedContentId: string;
  title: string;
  summary: string;
  createdBy: string;
  createdByName?: string;
}

interface Props {
  card: InviteCardData;
  communityId: string;
  onDismiss: (extractedContentId: string) => void;
}

export function InviteCard({ card, communityId, onDismiss }: Props) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleAction(action: "clicked_yes" | "clicked_no") {
    setLoading(true);
    try {
      const token = await getToken();
      await fetch(`${API_URL}/api/extrair/invite-card/${card.extractedContentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action }),
      });
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
      onDismiss(card.extractedContentId);
    }
  }

  return (
    <div
      className="mx-6 my-3 rounded-[14px] overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #0D1829 0%, #1249A0 100%)",
        border: "1px solid rgba(74,158,255,.30)",
        boxShadow: "0 4px 20px rgba(18,73,160,.25)",
      }}
    >
      <div className="px-5 py-4">
        {/* Badge */}
        <div className="flex items-center gap-[6px] mb-[10px]">
          <span style={{ color: "#4A9EFF", fontSize: 13 }}>✦</span>
          <span
            className="text-[10px] font-bold uppercase tracking-[0.1em]"
            style={{ color: "rgba(74,158,255,.9)" }}
          >
            Conteúdo gerado desta conversa
          </span>
        </div>

        {/* Title */}
        <p
          className="text-[14px] font-bold leading-[1.35] mb-[6px]"
          style={{ color: "#F0F4FA", letterSpacing: "-0.2px" }}
        >
          {card.createdByName ?? "Um moderador"} expandiu essa resposta na Sala Premium
        </p>

        {/* Summary preview */}
        <p className="text-[12.5px] leading-[1.55] mb-[14px]" style={{ color: "rgba(240,244,250,.65)" }}>
          {card.summary}
        </p>

        {/* CTA buttons */}
        <div className="flex gap-[8px]">
          <a
            href={`/communities/${communityId}/biblioteca`}
            onClick={() => void handleAction("clicked_yes")}
            className="flex-1 py-[9px] rounded-[8px] text-[12.5px] font-semibold text-center transition-all no-underline"
            style={{
              background: "#4A9EFF",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(74,158,255,.4)",
            }}
          >
            Conhecer a Sala Premium
          </a>
          <button
            type="button"
            onClick={() => void handleAction("clicked_no")}
            disabled={loading}
            className="px-[14px] py-[9px] rounded-[8px] text-[12px] font-medium transition-all"
            style={{
              background: "rgba(255,255,255,.08)",
              color: "rgba(240,244,250,.6)",
              border: "1px solid rgba(255,255,255,.12)",
            }}
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
