"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type SummaryState = "idle" | "loading" | "success" | "error";

export interface SummaryData {
  content: string;
  generatedAt: Date;
}

export function useSummary(topicId: string | undefined) {
  const [state, setState] = useState<SummaryState>("idle");
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { getToken } = useAuth();

  const generate = useCallback(async () => {
    if (!topicId) return;

    setState("loading");
    setErrorMessage(null);

    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/ai/summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ topicId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Erro ${res.status}`);
      }

      const data = await res.json() as { content: string; createdAt: string };
      setSummary({ content: data.content, generatedAt: new Date(data.createdAt) });
      setState("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao gerar resumo";
      setErrorMessage(msg);
      setState("error");
    }
  }, [topicId, getToken]);

  // Called by socket summary:updated event to sync real-time updates
  const onSocketUpdate = useCallback((content: string, generatedAt: Date) => {
    setSummary({ content, generatedAt });
    setState("success");
  }, []);

  const dismiss = useCallback(() => {
    setState("idle");
    setSummary(null);
    setErrorMessage(null);
  }, []);

  return { state, summary, errorMessage, generate, onSocketUpdate, dismiss };
}
