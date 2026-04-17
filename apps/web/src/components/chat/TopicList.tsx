"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useDarkMode } from "@/hooks/useDarkMode";
import type { TopicSummary } from "@/hooks/useTopicSocket";
import { AlbumSidebarTab } from "@/components/albums/AlbumSidebarTab";
import type { AlbumCardData } from "@/components/albums/AlbumCard";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TopicItem {
  id: string;
  title: string;
  messageCount: number;
  participantCount?: number;
  status: "active" | "resolved" | "closed" | "pending";
  isPinned: boolean;
  lastActivityAt: Date;
}

export interface OnlineMember {
  id: string;
  name: string;
  role?: string;
  lastSeenAt?: Date; // undefined = online now
}

export interface TopicListProps {
  communityId: string;
  communityName?: string;
  topics: TopicItem[];
  activeTopic: string;
  tags?: string[];
  members?: OnlineMember[];
  topicSummary?: TopicSummary | null;
  stats?: {
    messageCount: number;
    memberCount: number;
    topicCount: number;
    klipCount: number;
  };
  albums?: AlbumCardData[];
  isOwnerOrMod?: boolean;
  onOpenAlbum?: (albumId: string) => void;
  onPurchaseAlbum?: (albumId: string) => void;
  onCreateAlbum?: () => void;
  purchasingAlbumId?: string | null;
}

type Tab = "Tópicos" | "Decisões" | "Membros" | "Álbuns";

// ─── Status dot colors ────────────────────────────────────────────────────────

const STATUS_COLOR: Record<TopicItem["status"], string> = {
  active:   "var(--color-blue)",
  resolved: "var(--color-green)",
  closed:   "var(--color-text-3)",
  pending:  "var(--color-amber)",
};

function StatusDot({ status }: { status: TopicItem["status"] }) {
  return (
    <span
      className="w-[5px] h-[5px] rounded-full shrink-0"
      style={{ background: STATUS_COLOR[status] }}
      aria-label={status}
    />
  );
}

// ─── Online dot ───────────────────────────────────────────────────────────────

function onlineDotColor(lastSeenAt?: Date): string {
  if (!lastSeenAt) return "var(--color-green)";
  const mins = (Date.now() - lastSeenAt.getTime()) / 60000;
  if (mins < 5) return "var(--color-green)";
  if (mins < 60) return "var(--color-amber)";
  return "var(--color-text-3)";
}

function getAvatarColors(id: string, isDark = false): { bg: string; color: string } {
  const hue = parseInt(id.slice(0, 8).replace(/-/g, ""), 16) % 360;
  if (isDark) return { bg: `hsl(${hue}, 50%, 16%)`, color: `hsl(${hue}, 85%, 72%)` };
  return { bg: `hsl(${hue}, 65%, 85%)`, color: `hsl(${hue}, 65%, 25%)` };
}

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-3 mb-[10px]">
      {children}
    </p>
  );
}

function TagCloud({ tags, activeTag, onSelect }: { tags: string[]; activeTag: string | null; onSelect: (tag: string) => void }) {
  const display = tags.length > 0 ? tags : ["#geral", "#importante", "#decisão", "#dúvida"];
  return (
    <div className="flex flex-wrap gap-[5px] mb-[12px]">
      {display.map((tag) => {
        const isActive = activeTag === tag;
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onSelect(tag)}
            className="px-[10px] py-[4px] rounded-[20px] text-[11px] font-medium cursor-pointer transition-colors border"
            style={{
              background: isActive ? "var(--color-blue-dim)" : "var(--color-bg-surface)",
              borderColor: isActive ? "var(--color-blue-border)" : "var(--color-border)",
              color: isActive ? "var(--color-blue)" : "var(--color-text-2)",
            }}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}

function TopicRow({
  topic,
  communityId,
  isActive,
}: {
  topic: TopicItem;
  communityId: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={`/communities/${communityId}/topics/${topic.id}`}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "block px-[12px] py-[10px] rounded-[10px] border mb-[6px] cursor-pointer transition-all no-underline",
        isActive
          ? "border-[var(--color-blue-border)] shadow-[0_1px_8px_var(--color-blue-glow)]"
          : "border-[var(--color-border)] hover:border-[var(--color-border-mid)]"
      )}
      style={{
        background: isActive ? "var(--color-blue-dim2)" : "var(--color-bg-surface)",
      }}
    >
      <p
        className={cn(
          "text-[12.5px] font-semibold mb-[4px]",
          isActive ? "text-text-1" : "text-text-1"
        )}
      >
        {topic.isPinned && <span className="text-text-3 mr-[4px] text-[10px]">📌</span>}
        {topic.title}
      </p>
      <div className="flex items-center gap-[6px]" style={{ fontSize: 11, color: "var(--color-text-3)" }}>
        <StatusDot status={topic.status} />
        <span>{topic.messageCount} msgs</span>
        {topic.participantCount !== undefined && (
          <>
            <span style={{ color: "var(--color-border-mid)" }}>·</span>
            <span>{topic.participantCount} participantes</span>
          </>
        )}
      </div>
    </Link>
  );
}

function MembersSection({ members }: { members: OnlineMember[] }) {
  const { theme, mounted } = useDarkMode();
  const isDark = mounted && theme === "dark";
  return (
    <div className="mb-[14px]">
      <SectionLabel>Membros online · {members.length}</SectionLabel>
      <div>
        {members.map((m) => {
          const { bg, color } = getAvatarColors(m.id, isDark);
          return (
            <div
              key={m.id}
              className="flex items-center gap-[9px] py-[7px] border-b"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div
                className="w-[28px] h-[28px] rounded-[8px] flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{ background: bg, color }}
              >
                {getInitials(m.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-text-1 truncate">{m.name}</p>
                {m.role && <p className="text-[10px] text-text-3">{m.role}</p>}
              </div>
              <span
                className="w-[7px] h-[7px] rounded-full shrink-0"
                style={{ background: onlineDotColor(m.lastSeenAt) }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatsGrid({ stats }: { stats: NonNullable<TopicListProps["stats"]> }) {
  const items = [
    { val: stats.messageCount, label: "mensagens" },
    { val: stats.memberCount,  label: "membros" },
    { val: stats.topicCount,   label: "tópicos" },
    { val: stats.klipCount,    label: "klips" },
  ];
  return (
    <div className="grid grid-cols-2 gap-[8px] mb-[14px]">
      {items.map(({ val, label }) => (
        <div
          key={label}
          className="rounded-[10px] px-[12px] py-[8px] border transition-all hover:shadow-[0_2px_6px_rgba(0,0,0,.05)]"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-border-mid)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
        >
          <p
            className="font-bold text-text-1"
            style={{ fontSize: 16, fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.3px" }}
          >
            {val}
          </p>
          <p className="text-[10px] font-medium text-text-3 mt-[2px]">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── TopicList ────────────────────────────────────────────────────────────────

export function TopicList({
  communityId,
  communityName,
  topics,
  activeTopic,
  tags = [],
  members = [],
  topicSummary,
  stats,
  albums = [],
  isOwnerOrMod = false,
  onOpenAlbum,
  onPurchaseAlbum,
  onCreateAlbum,
  purchasingAlbumId,
}: TopicListProps) {
  const [activeTab, setActiveTab] = useState<Tab>("Tópicos");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const handleTagSelect = (tag: string) => {
    setActiveTag((prev) => (prev === tag ? null : tag));
  };

  const keyword = activeTag ? activeTag.replace(/^#/, "").toLowerCase() : null;
  const filteredTopics = keyword
    ? topics.filter((t) => t.title.toLowerCase().includes(keyword))
    : topics;

  const pinned  = filteredTopics.filter((t) => t.isPinned);
  const regular = filteredTopics.filter((t) => !t.isPinned);

  const defaultStats = stats ?? {
    messageCount: topics.reduce((s, t) => s + t.messageCount, 0),
    memberCount:  members.length,
    topicCount:   topics.length,
    klipCount:    0,
  };

  return (
    <aside
      className="hidden md:flex w-[280px] shrink-0 border-l border-border flex-col overflow-hidden"
      style={{ background: "var(--color-bg-surface)" }}
      aria-label="Painel do tópico"
    >
      {/* Tabs */}
      <div className="flex border-b border-border bg-bg-surface px-[2px] shrink-0">
        {(["Tópicos", "Decisões", "Membros", "Álbuns"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-[15px] text-[11px] font-medium text-center transition-colors border-b-[2px] -mb-px",
              activeTab === tab
                ? "font-bold"
                : "text-text-3 border-transparent hover:text-text-2"
            )}
            style={activeTab === tab ? { color: "var(--color-green)", borderBottomColor: "var(--color-green)" } : undefined}
          >
            {tab}
            {tab === "Álbuns" && albums.length > 0 && (
              <span
                className="ml-[4px] inline-flex items-center justify-center rounded-full text-[9px] font-bold"
                style={{
                  background: activeTab === "Álbuns" ? "#22C98A" : "rgba(255,255,255,.15)",
                  color: activeTab === "Álbuns" ? "#fff" : "var(--color-text-3)",
                  minWidth: 14, height: 14, padding: "0 4px",
                }}
              >
                {albums.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div
        className="flex-1 overflow-y-auto scrollbar-thin p-[14px]"
        style={{ background: "var(--color-bg-page)" }}
      >
        {/* ── Tab: Tópicos ── */}
        {activeTab === "Tópicos" && (
          <>
            <SectionLabel>
              {communityName ? `${communityName} · tópicos` : "Tópicos"}
            </SectionLabel>

            <TagCloud tags={tags} activeTag={activeTag} onSelect={handleTagSelect} />

            <div className="mb-[16px]">
              {pinned.map((topic) => (
                <TopicRow key={topic.id} topic={topic} communityId={communityId} isActive={topic.id === activeTopic} />
              ))}
              {regular.map((topic) => (
                <TopicRow key={topic.id} topic={topic} communityId={communityId} isActive={topic.id === activeTopic} />
              ))}
              {filteredTopics.length === 0 && (
                <p className="text-[12px] text-text-3 py-2">
                  {activeTag ? `Nenhum tópico com "${activeTag}".` : "Nenhum tópico ainda."}
                </p>
              )}
            </div>

            <div>
              <SectionLabel>Estatísticas</SectionLabel>
              <StatsGrid stats={defaultStats} />
            </div>
          </>
        )}

        {/* ── Tab: Decisões ── */}
        {activeTab === "Decisões" && (
          <>
            <SectionLabel>Decisões do tópico</SectionLabel>
            {!topicSummary || topicSummary.decisions.length === 0 ? (
              <div className="flex flex-col items-center gap-[8px] py-10 text-center">
                <p className="text-[13px] font-medium text-text-2">Nenhuma decisão ainda</p>
                <p className="text-[12px] text-text-3">Use "Resumo IA" no header para gerar um resumo com decisões.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-[8px]">
                {topicSummary.decisions.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-[10px] rounded-[8px] px-[12px] py-[10px]"
                    style={{
                      background: "var(--color-blue-dim2)",
                      border: "1px solid var(--color-blue-border)",
                    }}
                  >
                    <span
                      className="mt-[4px] w-[6px] h-[6px] rounded-full shrink-0"
                      style={{ background: "var(--color-blue-bright)" }}
                    />
                    <span className="text-[12.5px] text-text-2 leading-[1.5]">{d}</span>
                  </div>
                ))}
                <p className="text-[10px] text-text-3 text-center mt-[4px]">
                  Gerado em {topicSummary.generatedAt.toLocaleDateString("pt-BR")}
                </p>
              </div>
            )}
          </>
        )}

        {/* ── Tab: Membros ── */}
        {activeTab === "Membros" && (
          <>
            {members.length === 0 ? (
              <div className="flex flex-col items-center gap-[8px] py-10 text-center">
                <p className="text-[13px] font-medium text-text-2">Nenhum membro online</p>
              </div>
            ) : (
              <MembersSection members={members} />
            )}
          </>
        )}

        {/* ── Tab: Álbuns ── */}
        {activeTab === "Álbuns" && (
          <AlbumSidebarTab
            albums={albums}
            isOwnerOrMod={isOwnerOrMod}
            onOpenAlbum={onOpenAlbum ?? (() => {})}
            onPurchase={onPurchaseAlbum ?? (() => {})}
            onCreateAlbum={onCreateAlbum ?? (() => {})}
            purchasingId={purchasingAlbumId ?? null}
          />
        )}
      </div>
    </aside>
  );
}
