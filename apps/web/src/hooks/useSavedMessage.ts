"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Manages the saved state of a single message.
 * Provides optimistic UI updates with server sync.
 */
export function useSavedMessage(messageId: string, initialSaved: boolean) {
  const { getToken } = useAuth();
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [isPending, setIsPending] = useState(false);

  const toggle = useCallback(async () => {
    if (isPending) return;

    const next = !isSaved;
    setIsSaved(next); // optimistic update
    setIsPending(true);

    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/messages/${messageId}/save`, {
        method: next ? "POST" : "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        // Revert on failure
        setIsSaved(!next);
      }
    } catch {
      setIsSaved(!next);
    } finally {
      setIsPending(false);
    }
  }, [messageId, isSaved, isPending, getToken]);

  return { isSaved, isPending, toggle };
}
