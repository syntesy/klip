"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Sidebar } from "./Sidebar";
import type { CommunityWithMeta } from "./Sidebar";
import { KlipLogo } from "@/components/ui/KlipLogo";
import { usePremiumToast } from "@/hooks/usePremiumToast";

interface MobileLayoutProps {
  communities: CommunityWithMeta[];
  children: React.ReactNode;
}

function HamburgerIcon() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <line x1="0" y1="1" x2="18" y2="1" />
      <line x1="0" y1="7" x2="18" y2="7" />
      <line x1="0" y1="13" x2="18" y2="13" />
    </svg>
  );
}

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function MobileLayoutInner({ communities, children }: MobileLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const openSidebar = useCallback(() => setSidebarOpen(true), []);

  const { getToken } = useAuth();
  const { toasts, dismiss } = usePremiumToast(getToken);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-bg-page">
      <Sidebar communities={communities} isOpen={sidebarOpen} onClose={closeSidebar} />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Mobile-only top bar */}
        <div className="flex items-center h-[52px] px-4 border-b border-border bg-bg-surface shrink-0 md:hidden">
          <button
            type="button"
            onClick={openSidebar}
            aria-label="Abrir menu de navegação"
            className="flex items-center justify-center w-9 h-9 rounded-[8px] text-text-2 hover:bg-bg-subtle transition-colors shrink-0"
          >
            <HamburgerIcon />
          </button>
          {/* Centred logo */}
          <div className="flex-1 flex justify-center">
            <KlipLogo variant="full" size="sm" theme="light" />
          </div>
          {/* Mirror spacer keeps logo centred */}
          <div className="w-9 shrink-0" />
        </div>
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>

      {/* Premium toasts */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 items-center pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-[13px] font-medium"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border)",
                maxWidth: 360,
                boxShadow: "0 4px 20px rgba(0,0,0,.18)",
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>⭐</span>
              <div className="flex-1 min-w-0">
                <span className="text-text-1">Novo conteúdo premium: </span>
                <span className="font-semibold text-text-1 truncate">{toast.title}</span>
                <span className="text-text-3 ml-1">· {formatPrice(toast.price)}</span>
              </div>
              <Link
                href={`/communities/${toast.communityId}/premium`}
                onClick={() => dismiss(toast.id)}
                className="text-[12px] font-semibold text-blue hover:underline whitespace-nowrap shrink-0"
              >
                Ver
              </Link>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="text-text-3 hover:text-text-1 transition-colors shrink-0"
                aria-label="Fechar"
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="2" y1="2" x2="12" y2="12" /><line x1="12" y1="2" x2="2" y2="12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MobileLayout({ communities, children }: MobileLayoutProps) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <MobileLayoutInner communities={communities}>{children}</MobileLayoutInner>;
  }
  return <MobileLayoutInner communities={communities}>{children}</MobileLayoutInner>;
}
