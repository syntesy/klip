"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AppError]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{ background: "var(--color-danger-dim)", border: "1px solid var(--color-danger-border)" }}
      >
        <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M8 3v5M8 11v1" />
          <circle cx="8" cy="8" r="6.5" />
        </svg>
      </div>
      <p className="font-semibold text-text-1 mb-1">Algo deu errado</p>
      <p className="text-sm text-text-3 mb-6 max-w-xs">
        Ocorreu um erro inesperado. Tente novamente ou volte à página inicial.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="text-[13px] font-medium px-4 py-2 rounded-[8px] bg-blue text-white border-0 cursor-pointer hover:opacity-90 transition-opacity"
        >
          Tentar novamente
        </button>
        <Link
          href="/"
          className="text-[13px] text-text-2 hover:text-text-1 transition-colors"
        >
          Ir para o início
        </Link>
      </div>
    </div>
  );
}
