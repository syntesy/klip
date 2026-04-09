"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { MoreHorizontal, Rss, Bookmark, CheckSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { KlipLogo } from "@/components/ui/KlipLogo";
import { useDarkMode } from "@/hooks/useDarkMode";

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
}

// ─── Nav items ────────────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  matchExact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/",          label: "Feed",         icon: <Rss size={15} strokeWidth={1.75} />,         matchExact: true },
  { href: "/klips",     label: "Klips salvos", icon: <Bookmark size={15} strokeWidth={1.75} /> },
  { href: "/decisions", label: "Decisões",     icon: <CheckSquare size={15} strokeWidth={1.75} /> },
  { href: "/search",    label: "Busca IA",     icon: <Sparkles size={15} strokeWidth={1.75} /> },
];

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

function Logo() {
  return (
    <div className="flex items-center px-4 pt-4 pb-[14px] border-b border-[var(--color-sidebar-border)] shrink-0" style={{ gap: 11 }}>
      <KlipLogo variant="full" size="md" theme="light" />
    </div>
  );
}

function NavBadge({ count }: { count: number }) {
  return (
    <span className="ml-auto shrink-0 bg-[var(--color-blue-dim)] text-blue text-[10px] font-semibold leading-none px-[5px] py-[2px] rounded-[10px]">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavMenu({ pathname }: { pathname: string }) {
  return (
    <div className="px-2 pt-[14px] pb-1 shrink-0">
      <p className="text-[10px] font-semibold text-text-3 uppercase tracking-[0.1em] px-[10px] mb-[5px]">
        Menu
      </p>
      {NAV_ITEMS.map((item) => {
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
      className="w-[25px] h-[25px] rounded-[7px] flex items-center justify-center text-[10px] font-semibold shrink-0 leading-none"
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
    <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 pt-1">
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
            !pathname.includes("/biblioteca");
          const bibliotecaActive = pathname === `/communities/${community.id}/biblioteca`;
          return (
            <div key={community.id}>
              <Link
                href={`/communities/${community.id}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 px-[10px] py-[5px] rounded-[7px] text-[13px] mb-[1px] no-underline",
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
              {/* Sala Premium sub-item */}
              <Link
                href={`/communities/${community.id}/biblioteca`}
                aria-current={bibliotecaActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-[7px] pl-[32px] pr-[10px] py-[4px] rounded-[7px] text-[12px] mb-[1px] no-underline",
                  "transition-colors duration-[120ms]",
                  bibliotecaActive
                    ? "font-semibold bg-bg-surface shadow-[0_1px_4px_rgba(0,0,0,.07)]"
                    : "font-normal text-text-3 bg-transparent hover:bg-[var(--color-sidebar-hover)] hover:text-text-2"
                )}
                style={{ color: bibliotecaActive ? "var(--color-blue-bright)" : undefined }}
              >
                <span style={{ fontSize: 11, color: "var(--color-blue-bright)" }}>✦</span>
                <span>Sala Premium</span>
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

  if (!isLoaded) {
    return (
      <div className="h-[57px] shrink-0 border-t border-[var(--color-sidebar-border)]" />
    );
  }

  const displayName = user?.fullName ?? user?.firstName ?? "Usuário";
  const imageUrl = user?.imageUrl;

  return (
    <div className="flex items-center gap-[9px] px-[14px] py-[10px] border-t border-[var(--color-sidebar-border)] shrink-0">
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

      {/* Name + plan */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-text-1 truncate leading-[1.3]">
          {displayName}
        </p>
        <p className="text-[11px] text-text-3 leading-[1.3]">Plano Pro</p>
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

      {/* Three dots */}
      <button
        type="button"
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

export function Sidebar({ communities, isOpen = true }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 z-20 md:hidden" aria-hidden="true" />
      )}

      <nav
        aria-label="Navegação principal"
        className={cn(
          "w-[220px] min-w-[220px] max-w-[220px] h-screen",
          "flex flex-col bg-sidebar overflow-hidden shrink-0",
          "border-r border-[var(--color-sidebar-border)]",
          // Mobile: fixed + slide
          "fixed top-0 left-0 z-30 transition-transform duration-200 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: always visible, no transition
          "md:relative md:translate-x-0 md:transition-none",
        )}
      >
        <Logo />
        <NavMenu pathname={pathname} />

        {/* Divider */}
        <div className="h-px mx-[14px] my-1 bg-[var(--color-sidebar-border)] opacity-60 shrink-0" />

        <CommunityList communities={communities} pathname={pathname} />
        <UserFooter />
      </nav>
    </>
  );
}
