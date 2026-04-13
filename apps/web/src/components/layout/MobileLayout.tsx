"use client";

import { useState, useCallback } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { Sidebar } from "./Sidebar";
import type { CommunityWithMeta } from "./Sidebar";
import { usePremiumToast } from "@/hooks/usePremiumToast";

interface MobileLayoutProps {
  communities: CommunityWithMeta[];
  children: React.ReactNode;
}

// ─── Wordmark ─────────────────────────────────────────────────────────────────

function KlipWordmark() {
  return (
    <span
      aria-label="Klip"
      style={{
        fontSize: 33,
        fontWeight: 800,
        color: "#ffffff",
        letterSpacing: "-1.2px",
        lineHeight: 1,
        fontFamily: "var(--klip-font-display)",
        userSelect: "none",
      }}
    >
      k<span style={{ color: "#4A9EFF" }}>l</span>ip
    </span>
  );
}

// ─── Hamburger ────────────────────────────────────────────────────────────────

function HamburgerIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden="true">
      <line x1="0" y1="1" x2="16" y2="1" stroke="#5a7a9a" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="0" y1="6" x2="16" y2="6" stroke="#5a7a9a" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="0" y1="11" x2="16" y2="11" stroke="#5a7a9a" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// ─── User avatar (top-right) ──────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function TopNavAvatar() {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return <div style={{ width: 32, height: 32 }} />;

  const name = user?.fullName ?? user?.firstName ?? "U";
  const initials = getInitials(name);
  const imageUrl = user?.imageUrl;

  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: "#1249A0",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {imageUrl ? (
        <Image src={imageUrl} alt={name} width={32} height={32} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
      ) : (
        <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{initials}</span>
      )}
    </div>
  );
}

// ─── Top navigation bar ───────────────────────────────────────────────────────

interface TopNavProps {
  onMenuOpen: () => void;
}

function TopNav({ onMenuOpen }: TopNavProps) {
  const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <div
      className="md:hidden shrink-0 flex items-center justify-between"
      style={{
        background: "#08111f",
        paddingTop: "max(8px, env(safe-area-inset-top, 8px))",
        paddingBottom: 10,
        paddingLeft: 18,
        paddingRight: 18,
        borderBottom: "0.5px solid #1a2e4a",
      }}
    >
      {/* Hamburguer */}
      <button
        type="button"
        onClick={onMenuOpen}
        aria-label="Abrir menu de navegação"
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: "#0f1e35",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          cursor: "pointer",
        }}
      >
        <HamburgerIcon />
      </button>

      {/* Wordmark centralizado */}
      <KlipWordmark />

      {/* Avatar do usuário */}
      {hasClerk ? <TopNavAvatar /> : <div style={{ width: 32, height: 32 }} />}
    </div>
  );
}

// ─── Premium toasts ───────────────────────────────────────────────────────────

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── Layout interno ───────────────────────────────────────────────────────────

function MobileLayoutInner({ communities, children }: MobileLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const openSidebar = useCallback(() => setSidebarOpen(true), []);

  const { getToken } = useAuth();
  const { toasts, dismiss } = usePremiumToast(getToken);

  return (
    <div
      style={{ display: "flex", height: "100dvh", overflow: "hidden", background: "#08111f" }}
    >
      {/* Sidebar — desktop sempre visível, mobile drawer */}
      <Sidebar communities={communities} isOpen={sidebarOpen} onClose={closeSidebar} />

      {/* Conteúdo principal */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minWidth: 0 }}>
        {/* Top nav — só mobile */}
        <TopNav onMenuOpen={openSidebar} />

        {/* Conteúdo da página */}
        <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
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
                background: "#0d1e35",
                border: "0.5px solid #1a2e4a",
                maxWidth: 360,
                boxShadow: "0 4px 20px rgba(0,0,0,.4)",
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>⭐</span>
              <div className="flex-1 min-w-0">
                <span style={{ color: "#f0f6ff" }}>Novo conteúdo premium: </span>
                <span style={{ fontWeight: 600, color: "#fff" }} className="truncate">{toast.title}</span>
                <span style={{ color: "#8AAAC8", marginLeft: 4 }}>· {formatPrice(toast.price)}</span>
              </div>
              <Link
                href={`/communities/${toast.communityId}/premium`}
                onClick={() => dismiss(toast.id)}
                style={{ fontSize: 12, fontWeight: 600, color: "#4A9EFF", whiteSpace: "nowrap", flexShrink: 0 }}
              >
                Ver
              </Link>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                style={{ color: "#5a7a9a", flexShrink: 0 }}
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
  return <MobileLayoutInner communities={communities}>{children}</MobileLayoutInner>;
}
