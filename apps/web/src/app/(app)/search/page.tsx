"use client";

export default function SearchPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 md:px-8">
      <div className="w-full max-w-xl">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--color-blue-dim)", border: "1px solid var(--color-blue-border)" }}
          >
            <svg width="26" height="26" viewBox="0 0 16 16" fill="none" stroke="var(--color-blue)" strokeWidth="1.5" aria-hidden="true">
              <path d="M5.5 1L6.4 4.2L9.5 5.5L6.4 6.8L5.5 10L4.6 6.8L1.5 5.5L4.6 4.2L5.5 1Z" strokeLinejoin="round" />
              <path d="M12 9L12.6 11L14.5 12L12.6 13L12 15L11.4 13L9.5 12L11.4 11Z" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <h1
          className="text-[24px] font-bold text-text-1 text-center mb-[6px]"
          style={{ letterSpacing: "-0.4px" }}
        >
          Busca IA
        </h1>
        <p className="text-[14px] text-text-3 text-center mb-8">
          Em breve — busca semântica com IA em todas as suas comunidades
        </p>

        {/* Search field (disabled preview) */}
        <div className="relative">
          <div
            className="w-full px-[16px] py-[14px] rounded-[14px] text-[14px] text-text-3 flex items-center gap-3"
            style={{
              background: "var(--color-input-bg)",
              border: "1.5px solid var(--color-input-border)",
              cursor: "not-allowed",
              opacity: 0.6,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" strokeLinecap="round" />
            </svg>
            Busque em todas as suas comunidades...
          </div>
        </div>

        {/* Coming soon badge */}
        <div className="flex justify-center mt-6">
          <span
            className="text-[11px] font-semibold px-[12px] py-[5px] rounded-[20px]"
            style={{
              background: "var(--color-blue-dim)",
              border: "1px solid var(--color-blue-border)",
              color: "var(--color-blue)",
            }}
          >
            Em desenvolvimento
          </span>
        </div>
      </div>
    </div>
  );
}
