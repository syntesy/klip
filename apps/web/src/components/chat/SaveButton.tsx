"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useSavedMessage } from "@/hooks/useSavedMessage";

interface SaveButtonProps {
  messageId: string;
  initialSaved: boolean;
  btnStyle: React.CSSProperties;
  btnColor: string;
  btnHoverColor: string;
}

/** Bookmark button shown in MessageHoverBar for Pro/Business users. */
export function SaveButton({ messageId, initialSaved, btnStyle, btnColor, btnHoverColor }: SaveButtonProps) {
  const undoRef = useRef<ReturnType<typeof setTimeout>>();
  const { isSaved, isPending, toggle } = useSavedMessage(messageId, initialSaved);

  const handleToggle = useCallback(async () => {
    const wasSaved = isSaved;
    await toggle();
    if (wasSaved) {
      // Show "Removido · Desfazer" toast (5s)
      const toastId = toast("Removido da biblioteca", {
        duration: 5000,
        action: {
          label: "Desfazer",
          onClick: () => {
            clearTimeout(undoRef.current);
            void toggle();
            toast.dismiss(toastId);
          },
        },
      });
    } else {
      toast.success("Salvo na sua biblioteca", { duration: 3000 });
    }
  }, [isSaved, toggle]);

  return (
    <button
      type="button"
      onClick={() => void handleToggle()}
      disabled={isPending}
      title={isSaved ? "Remover da biblioteca" : "Salvar na biblioteca"}
      style={{
        ...btnStyle,
        color: isSaved ? "#4A9EFF" : btnColor,
        opacity: isPending ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!isSaved) (e.currentTarget as HTMLButtonElement).style.color = btnHoverColor;
      }}
      onMouseLeave={(e) => {
        if (!isSaved) (e.currentTarget as HTMLButtonElement).style.color = btnColor;
      }}
    >
      {/* Bookmark icon */}
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill={isSaved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 2h10a1 1 0 0 1 1 1v11l-6-3-6 3V3a1 1 0 0 1 1-1z" />
      </svg>
    </button>
  );
}
