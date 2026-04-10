"use client";

import { useState, useCallback } from "react";
import { Sidebar } from "./Sidebar";
import type { CommunityWithMeta } from "./Sidebar";
import { KlipLogo } from "@/components/ui/KlipLogo";

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

export function MobileLayout({ communities, children }: MobileLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const openSidebar = useCallback(() => setSidebarOpen(true), []);

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
    </div>
  );
}
