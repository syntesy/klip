"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useUser, useClerk, useAuth } from "@clerk/nextjs";
import { MoreHorizontal, Rss, Bookmark, CheckSquare, Sparkles, LogOut } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { KlipLogo } from "@/components/ui/KlipLogo";
import { useDarkMode } from "@/hooks/useDarkMode";

// ─── User menu dropdown ───────────────────────────────────────────────────────

function UserMenu({ onClose }: { onClose: () => void }) {
  const { signOut } = useClerk();
  return (
    <div className="absolute bottom-[48px] right-[8px] z-50 bg-bg-surface border border-border rounded-[10px] shadow-lg py-1 w-[160px]">
      <button
        type="button"
        onClick={() => signOut({ redirectUrl: "/sign-in" })}
        className="flex items-center gap-2 w-full px-3 py-[7px] text-[13px] text-red-500 hover:bg-bg-subtle transition-colors rounded-[7px] mx-1 pr-2"
        style={{ width: "calc(100% - 8px)" }}
      >
        <LogOut size={13} strokeWidth={1.75} />
        Sair da conta
      </button>
    </div>
  );
}

// ─── Theme icons ─────────────────────────────────────────────────────────────

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.5 10A6 6 0 016 2.5a6 6 0 100 11 6 6 0 007.5-3.5z" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string;
}

export interface CommunityWithMeta extends Community {
  hasUnread?: boolean;
}

export interface SidebarProps {
  communities: CommunityWithMeta[];
  isOpen?: boolean;
  onClose?: () => void;
}

// ─── Nav items ────────────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  matchExact?: boolean;
}

const NAV_ITEMS_BASE: NavItem[] = [
  { href: "/",          label: "Feed",                icon: <Rss size={15} strokeWidth={1.75} />,         matchExact: true },
  { href: "/klips",     label: "Klips salvos",        icon: <Bookmark size={15} strokeWidth={1.75} /> },
  { href: "/library",   label: "Biblioteca Pessoal",  icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 2h10a1 1 0 0 1 1 1v11l-6-3-6 3V3a1 1 0 0 1 1-1z" />
    </svg>
  )},
  { href: "/decisions", label: "Decisões",            icon: <CheckSquare size={15} strokeWidth={1.75} /> },
  { href: "/search",    label: "Busca IA",            icon: <Sparkles size={15} strokeWidth={1.75} /> },
];

const API_URL_SIDEBAR = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Fetches saved-messages count for the library badge. Returns 0 on any error. */
function useSavedMessagesCount() {
  const { getToken } = useAuth();
  const [count, setCount] = useState(0);
  const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  useEffect(() => {
    if (!hasClerk) return;
    let cancelled = false;
    async function fetch_count() {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL_SIDEBAR}/api/me/saved-messages/count`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok && !cancelled) {
          const data = await res.json() as { count: number };
          setCount(data.count);
        }
      } catch {
        // non-fatal
      }
    }
    void fetch_count();
    return () => { cancelled = true; };
  }, [getToken, hasClerk]);

  return count;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function getAvatarColors(id: string, isDark = false): { bg: string; color: string } {
  const hue = parseInt(id.slice(0, 8), 16) % 360;
  if (isDark) {
    return {
      bg: `hsl(${hue}, 50%, 16%)`,
      color: `hsl(${hue}, 85%, 72%)`,
    };
  }
  return {
    bg: `hsl(${hue}, 65%, 85%)`,
    color: `hsl(${hue}, 65%, 25%)`,
  };
}

function isNavActive(href: string, pathname: string, matchExact = false): boolean {
  if (matchExact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavBadge({ count }: { count: number }) {
  return (
    <span className="ml-auto shrink-0 bg-[var(--color-blue-dim)] text-blue text-[10px] font-semibold leading-none px-[5px] py-[2px] rounded-[10px]">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavMenu({ pathname }: { pathname: string }) {
  const savedCount = useSavedMessagesCount();
  const navItems: NavItem[] = NAV_ITEMS_BASE.map((item) =>
    item.href === "/library" && savedCount > 0
      ? { ...item, badge: savedCount }
      : item
  );

  return (
    <div className="px-3 pt-[14px] pb-1 shrink-0">
      <p className="text-[10px] font-semibold text-text-3 uppercase tracking-[0.1em] px-[10px] mb-[5px]">
        Menu
      </p>
      {navItems.map((item) => {
        const active = isNavActive(item.href, pathname, item.matchExact);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 px-[10px] py-[6px] rounded-[7px] text-[13px] mb-[1px] no-underline",
              "border-l-[2.5px] transition-colors duration-[120ms]",
              active
                ? "font-semibold text-blue bg-bg-surface border-l-blue shadow-[0_1px_4px_rgba(0,0,0,.07)]"
                : "font-normal text-text-2 bg-transparent border-l-transparent hover:bg-[var(--color-sidebar-hover)] hover:text-text-1"
            )}
          >
            <span className="flex items-center shrink-0">{item.icon}</span>
            <span className="flex-1 min-w-0 truncate">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <NavBadge count={item.badge} />
            )}
          </Link>
        );
      })}
    </div>
  );
}

function CommunityAvatar({ community }: { community: Community }) {
  const { theme, mounted } = useDarkMode();
  const isDark = mounted && theme === "dark";
  const { bg, color } = getAvatarColors(community.id, isDark);
  return (
    <div
      className="w-[28px] h-[28px] rounded-[6px] flex items-center justify-center text-[10px] font-semibold shrink-0 leading-none"
      style={{ backgroundColor: bg, color }}
      aria-hidden="true"
    >
      {getInitials(community.name)}
    </div>
  );
}

function CommunityList({
  communities,
  pathname,
}: {
  communities: CommunityWithMeta[];
  pathname: string;
}) {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-2 pt-1">
      <p className="text-[10px] font-semibold text-text-3 uppercase tracking-[0.1em] px-[10px] pt-[6px] pb-[8px]">
        Comunidades
      </p>

      {communities.length === 0 ? (
        <p className="text-[12px] text-text-3 px-[10px] py-2">
          Nenhuma comunidade ainda
        </p>
      ) : (
        communities.map((community) => {
          const active = pathname.startsWith(`/communities/${community.id}`) &&
            !pathname.includes("/premium");
          const premiumActive = pathname === `/communities/${community.id}/premium`;
          return (
            <div key={community.id}>
              <Link
                href={`/communities/${community.id}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-[10px] px-[10px] py-[5px] rounded-[7px] text-[13px] mb-[1px] no-underline",
                  "transition-colors duration-[120ms]",
                  active
                    ? "font-semibold text-text-1 bg-bg-surface shadow-[0_1px_4px_rgba(0,0,0,.07)]"
                    : "font-normal text-text-2 bg-transparent hover:bg-[var(--color-sidebar-hover)] hover:text-text-1"
                )}
              >
                <CommunityAvatar community={community} />
                <span className="flex-1 min-w-0 truncate">{community.name}</span>
                {community.hasUnread && (
                  <span
                    className="w-[6px] h-[6px] rounded-full bg-blue-bright shrink-0"
                    aria-label="mensagens não lidas"
                  />
                )}
              </Link>
              {/* Área Premium sub-item */}
              <Link
                href={`/communities/${community.id}/premium`}
                aria-current={premiumActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-[7px] pl-[32px] pr-[10px] py-[4px] rounded-[7px] text-[12px] mb-[1px] no-underline",
                  "transition-colors duration-[120ms]",
                  premiumActive
                    ? "font-semibold bg-bg-surface shadow-[0_1px_4px_rgba(0,0,0,.07)]"
                    : "font-normal text-text-3 bg-transparent hover:bg-[var(--color-sidebar-hover)] hover:text-text-2"
                )}
                style={{ color: premiumActive ? "#F5C842" : undefined }}
              >
                <span style={{ fontSize: 11 }}>⭐</span>
                <span>Área Premium</span>
              </Link>
            </div>
          );
        })
      )}
    </div>
  );
}

function UserFooterWithClerk() {
  const { user, isLoaded } = useUser();
  const { theme, toggle, mounted } = useDarkMode();
  const isDark = mounted && theme === "dark";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  if (!isLoaded) {
    return (
      <div className="h-[57px] shrink-0 border-t border-[var(--color-sidebar-border)]" />
    );
  }

  const displayName = user?.fullName ?? user?.firstName ?? "Usuário";
  const imageUrl = user?.imageUrl;

  return (
    <div ref={menuRef} className="relative flex items-center gap-[9px] px-[14px] py-[10px] border-t border-[var(--color-sidebar-border)] shrink-0">
      {menuOpen && <UserMenu onClose={() => setMenuOpen(false)} />}

      {/* Avatar */}
      <div
        className="w-[32px] h-[32px] rounded-full overflow-hidden shrink-0 flex items-center justify-center text-[12px] font-bold text-white"
        style={{
          background: "linear-gradient(135deg,#1249A0,#4A9EFF)",
          boxShadow: "0 0 0 2px var(--color-bg-surface), 0 0 0 3.5px var(--color-blue-bright)",
        }}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={displayName}
            width={32}
            height={32}
            className="object-cover w-full h-full"
          />
        ) : (
          <span>{getInitials(displayName)}</span>
        )}
      </div>

      {/* Name + email */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-text-1 truncate leading-[1.3]">
          {displayName}
        </p>
        <p className="text-[11px] text-text-3 leading-[1.3] truncate">
          {user?.primaryEmailAddress?.emailAddress ?? ""}
        </p>
      </div>

      {/* Dark mode toggle */}
      <button
        type="button"
        onClick={toggle}
        aria-label={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
        title={isDark ? "Modo claro" : "Modo escuro"}
        className="flex items-center justify-center w-6 h-6 rounded-[6px] border-0 bg-transparent text-text-3 cursor-pointer shrink-0 p-0 transition-colors hover:bg-[var(--color-sidebar-hover)] hover:text-text-2"
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>

      {/* Three dots → opens user menu */}
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Opções do usuário"
        className="flex items-center justify-center w-6 h-6 rounded-[6px] border-0 bg-transparent text-text-3 cursor-pointer shrink-0 p-0 transition-colors hover:bg-[var(--color-sidebar-hover)]"
      >
        <MoreHorizontal size={15} />
      </button>
    </div>
  );
}

// UserFooter — conditionally uses Clerk; falls back to guest UI when no key configured
function UserFooterDev() {
  const { theme, toggle, mounted } = useDarkMode();
  const isDark = mounted && theme === "dark";

  return (
    <div className="flex items-center gap-[9px] px-[14px] py-[10px] border-t border-[var(--color-sidebar-border)] shrink-0">
      <div
        className="w-[32px] h-[32px] rounded-full overflow-hidden shrink-0 flex items-center justify-center text-[12px] font-bold text-white"
        style={{
          background: "linear-gradient(135deg,#1249A0,#4A9EFF)",
          boxShadow: "0 0 0 2px var(--color-bg-surface), 0 0 0 3.5px var(--color-blue-bright)",
        }}
      >
        <span>?</span>
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[12px] font-medium text-text-1 truncate leading-none">Dev mode</span>
        <span className="text-[10px] text-text-3 truncate mt-[2px]">sem Clerk configurado</span>
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-label={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
        title={isDark ? "Modo claro" : "Modo escuro"}
        className="flex items-center justify-center w-6 h-6 rounded-[6px] border-0 bg-transparent text-text-3 cursor-pointer shrink-0 p-0 transition-colors hover:bg-[var(--color-sidebar-hover)] hover:text-text-2"
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>
    </div>
  );
}

function UserFooter() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <UserFooterDev />;
  }
  return <UserFooterWithClerk />;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({ communities, isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();

  // Swipe-to-close: track touch start X; swipe left ≥ 60px closes the drawer
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]!.clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0]!.clientX - touchStartX.current;
    if (dx < -60) onClose?.();
  };

  return (
    <>
      {/* Mobile backdrop — animated opacity, tap to close */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-20 bg-black/60 md:hidden",
          "transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
      />

      <nav
        aria-label="Navegação principal"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        // Close sidebar when any link inside is tapped on mobile
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) onClose?.();
        }}
        className={cn(
          "w-[240px] min-w-[240px] max-w-[240px] h-screen",
          "flex flex-col bg-sidebar overflow-hidden shrink-0",
          "border-r border-[var(--color-sidebar-border)]",
          // Mobile: fixed + slide
          "fixed top-0 left-0 z-30 transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: always visible, no transition
          "md:relative md:translate-x-0 md:transition-none",
        )}
      >
        {/* Logo row — on mobile shows X close button + safe area top */}
        <div
          className="flex items-center justify-between px-4 pb-[14px] border-b border-[var(--color-sidebar-border)] shrink-0"
          style={{ gap: 8, paddingTop: "max(16px, env(safe-area-inset-top))" }}
        >
          <KlipLogo variant="full" size="md" theme="light" />
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar menu"
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-[8px] text-text-3 hover:bg-[var(--color-sidebar-hover)] hover:text-text-2 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="2" y1="2" x2="12" y2="12" />
                <line x1="12" y1="2" x2="2" y2="12" />
              </svg>
            </button>
          )}
        </div>

        <NavMenu pathname={pathname} />

        {/* Divider */}
        <div className="h-px mx-[14px] my-1 bg-[var(--color-sidebar-border)] opacity-60 shrink-0" />

        <CommunityList communities={communities} pathname={pathname} />
        <UserFooter />
      </nav>
    </>
  );
}
