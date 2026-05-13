"use client";

import { X } from "lucide-react";
import type { SummaryData } from "@/hooks/useSummary";

interface Props {
  summary: SummaryData;
  accentColor?: string;
  onDismiss: () => void;
}

function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "agora mesmo";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

// Renders markdown **bold** as <strong> with Anchor Blue color (#1249A0)
// to distinguish IA-generated bold from user bold (which is black).
function renderContent(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} style={{ color: "#1249A0", fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function SummaryCard({ summary, accentColor = "#4A9EFF", onDismiss }: Props) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        padding: 24,
        borderLeft: `3px solid ${accentColor}`,
        position: "relative",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#1249A0",
            }}
          >
            Klip Resumiu
          </span>
          <span style={{ fontSize: 11, color: "#6B8BAF" }}>
            · atualizado {timeAgo(summary.generatedAt)}
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar resumo"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 4,
            color: "#6B8BAF",
            display: "flex",
            alignItems: "center",
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Content — newlines become paragraphs */}
      <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--color-text-1, #1a2a3a)" }}>
        {summary.content.split("\n").filter(Boolean).map((line, i) => (
          <p key={i} style={{ margin: "0 0 8px" }}>
            {renderContent(line.replace(/^#+\s*/, ""))}
          </p>
        ))}
      </div>
    </div>
  );
}
