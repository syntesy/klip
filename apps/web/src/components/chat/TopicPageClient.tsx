"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TopicHeader, type TopicMeta, type PinnedMessage } from "@/components/chat/TopicHeader";
import { TopicChatArea } from "@/components/chat/TopicChatArea";
import { TopicList, type TopicItem } from "@/components/chat/TopicList";
import { NewTopicModal } from "@/components/communities/NewTopicButton";
import type { Message } from "@/components/chat/MessageFeed";
import type { TopicSummary } from "@/hooks/useTopicSocket";
import { AlbumCreateModal } from "@/components/albums/AlbumCreateModal";
import { AlbumViewer, type AlbumPhoto } from "@/components/albums/AlbumViewer";
import type { AlbumCardData } from "@/components/albums/AlbumCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ─── Search types ─────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function getAvatarBg(id: string) {
  const hue = parseInt(id.replace(/-/g, "").slice(0, 8), 16) % 360;
  return { background: `hsl(${hue},45%,18%)`, color: `hsl(${hue},80%,72%)` };
}

function highlightTerm(text: string, term: string): React.ReactNode {
  if (!term) return text;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((p, i) =>
    p.toLowerCase() === term.toLowerCase()
      ? <mark key={i} style={{ background: "#F5C842", color: "#111", borderRadius: 2, padding: "0 1px" }}>{p}</mark>
      : p
  );
}

// ─── SearchResultsPanel ───────────────────────────────────────────────────────

function SearchResultsPanel({
  query,
  results,
  isLoading,
  onResultClick,
}: {
  query: string;
  results: SearchResult[] | null;
  isLoading: boolean;
  onResultClick: (id: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto bg-bg-page px-6 py-5 flex flex-col gap-3">
      {/* Count */}
      {!isLoading && results !== null && (
        <p className="text-[12px] text-text-3 shrink-0">
          {results.length === 0
            ? `Nenhuma mensagem com "${query}"`
            : `${results.length} resultado${results.length > 1 ? "s" : ""} para "${query}"`}
        </p>
      )}

      {isLoading && (
        <p className="text-[12px] text-text-3 shrink-0">Buscando…</p>
      )}

      {results?.map((r) => {
        const preview = r.content.length > 160 ? r.content.slice(0, 160) + "…" : r.content;
        const date = format(new Date(r.createdAt), "d MMM, HH:mm", { locale: ptBR });
        const avatarStyle = getAvatarBg(r.authorId);
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onResultClick(r.id)}
            className="flex items-start gap-[10px] text-left rounded-[10px] px-[14px] py-[10px] border border-border bg-bg-surface hover:bg-bg-subtle hover:border-[var(--color-border-mid)] transition-colors"
          >
            {/* Avatar */}
            <div
              className="w-[32px] h-[32px] rounded-[8px] flex items-center justify-center text-[11px] font-bold shrink-0"
              style={avatarStyle}
            >
              {getInitials(r.authorName)}
            </div>
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-[8px] mb-[3px]">
                <span className="text-[13px] font-semibold text-text-1">{r.authorName}</span>
                <span className="text-[11px] text-text-3 font-mono">{date}</span>
              </div>
              <p className="text-[13px] text-text-2 leading-[1.5] break-words">
                {highlightTerm(preview, query)}
              </p>
            </div>
          </button>
        );
      })}

      {!isLoading && results === null && query.length >= 2 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] text-text-3">Digite para buscar…</p>
        </div>
      )}

      {!isLoading && query.length < 2 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] text-text-3">Digite ao menos 2 caracteres</p>
        </div>
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TopicPageClientProps {
  communityId: string;
  topicId: string;
  topic: TopicMeta;
  initialTopics: TopicItem[];
  initialMessages: Message[];
  initialSummary: TopicSummary | null;
  isAdmin?: boolean;
  canSave?: boolean;
}

// ─── Decisions modal ──────────────────────────────────────────────────────────

function DecisionsModal({ summary, onClose }: { summary: TopicSummary | null; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-bg-surface rounded-2xl border border-border shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-text-1">Decisões do tópico</h2>
          <button type="button" onClick={onClose} className="text-text-3 hover:text-text-2 text-lg leading-none">×</button>
        </div>
        {!summary || summary.decisions.length === 0 ? (
          <p className="text-[13px] text-text-3 py-4 text-center">
            Nenhuma decisão registrada ainda.<br />
            <span className="text-[12px]">Use "Resumo IA" para gerar um resumo com decisões.</span>
          </p>
        ) : (
          <div className="flex flex-col gap-[8px]">
            {summary.decisions.map((d, i) => (
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
                <span className="text-[13px] text-text-2 leading-[1.5]">{d}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 text-[11px] text-text-3 text-center">
          {summary && `Gerado ${summary.generatedAt.toLocaleDateString("pt-BR")}`}
        </div>
      </div>
    </div>
  );
}

// ─── TopicPageClient ──────────────────────────────────────────────────────────

export function TopicPageClient({
  communityId,
  topicId,
  topic,
  initialTopics,
  initialMessages,
  initialSummary,
  isAdmin = false,
  canSave = false,
}: TopicPageClientProps) {
  const { getToken } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [decisionsOpen, setDecisionsOpen] = useState(false);
  const [summary, setSummary] = useState<TopicSummary | null>(initialSummary);
  const [albums, setAlbums] = useState<AlbumCardData[]>([]);
  const [albumCreateOpen, setAlbumCreateOpen] = useState(false);
  const [viewerAlbum, setViewerAlbum] = useState<{ title: string; photos: AlbumPhoto[] } | null>(null);
  const [purchasingAlbumId, setPurchasingAlbumId] = useState<string | null>(null);
  // Pinned message state — initialized from server data
  const [pinnedMessage, setPinnedMessage] = useState<PinnedMessage | null>(
    topic.pinnedMessageId && topic.pinnedMessageContent && topic.pinnedMessageAuthor
      ? { messageId: topic.pinnedMessageId, content: topic.pinnedMessageContent, authorName: topic.pinnedMessageAuthor }
      : null
  );

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearchOpen = useCallback(() => setIsSearchOpen(true), []);

  const handleSearchClose = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setSearchResults(null);
    clearTimeout(searchDebounceRef.current);
  }, []);

  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q);
    setSearchResults(null);
    clearTimeout(searchDebounceRef.current);
    if (q.trim().length < 2) return;
    setIsSearchLoading(true);
    searchDebounceRef.current = setTimeout(async () => {
      const token = await getToken();
      try {
        const res = await fetch(
          `${API_URL}/api/topics/${topicId}/messages/search?q=${encodeURIComponent(q.trim())}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (res.ok) setSearchResults(await res.json() as SearchResult[]);
      } catch { /* non-fatal */ } finally {
        setIsSearchLoading(false);
      }
    }, 400);
  }, [topicId, getToken]);

  const handleResultClick = useCallback((messageId: string) => {
    handleSearchClose();
    // Small delay so the chat area re-renders before we scroll
    setTimeout(() => {
      const el = document.getElementById(`msg-${messageId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }, 100);
  }, [handleSearchClose]);

  // Clear debounce on unmount
  useEffect(() => () => clearTimeout(searchDebounceRef.current), []);

  // Ref populated by TopicChatArea on mount — lets TopicHeader trigger the API call
  const requestSummaryRef = useRef<(() => Promise<void>) | null>(null);

  const handleMount = useCallback((handlers: { requestSummary: () => Promise<void> }) => {
    requestSummaryRef.current = handlers.requestSummary;
  }, []);

  const handleRequestSummary = useCallback(() => {
    void requestSummaryRef.current?.();
  }, []);

  const handlePin = useCallback(async (msg: Message) => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/api/topics/${topicId}/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ messageId: msg.id, content: msg.content, authorName: msg.author.name }),
    }).catch(() => null);
    if (res?.ok) {
      setPinnedMessage({ messageId: msg.id, content: msg.content, authorName: msg.author.name });
    }
  }, [topicId, getToken]);

  const handleUnpin = useCallback(async () => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/api/topics/${topicId}/pin`, {
      method: "DELETE",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    }).catch(() => null);
    if (res?.ok) {
      setPinnedMessage(null);
    }
  }, [topicId, getToken]);

  const handleScrollToPin = useCallback(() => {
    if (!pinnedMessage) return;
    const el = document.getElementById(`msg-${pinnedMessage.messageId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pinnedMessage]);

  // ── Album handlers ───────────────────────────────────────────────────────────

  // Fetch albums on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchAlbums() {
      const token = await getToken();
      try {
        const res = await fetch(
          `${API_URL}/api/communities/${communityId}/albums?topicId=${topicId}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (res.ok && !cancelled) {
          const data = await res.json() as AlbumCardData[];
          setAlbums(data);
        }
      } catch { /* non-fatal */ }
    }
    void fetchAlbums();
    return () => { cancelled = true; };
  }, [communityId, topicId, getToken]);

  const handleAlbumPublished = useCallback(
    (payload: { albumId: string; topicId: string | null | undefined; album: Record<string, unknown> }) => {
      // Only add albums for this topic (or community-wide albums)
      const album = payload.album as unknown as AlbumCardData;
      setAlbums((prev) => {
        if (prev.some((a) => a.id === album.id)) return prev;
        return [album, ...prev];
      });
    },
    []
  );

  const handleAlbumPurchased = useCallback(
    (payload: { albumId: string; photos: Record<string, unknown>[] }) => {
      // Mark the album as purchased in the list
      setAlbums((prev) =>
        prev.map((a) =>
          a.id === payload.albumId ? { ...a, hasPurchased: true } : a
        )
      );
      // Open viewer with the now-unlocked photos
      const album = albums.find((a) => a.id === payload.albumId);
      if (album) {
        const photos = payload.photos as unknown as AlbumPhoto[];
        setViewerAlbum({ title: album.title, photos });
      }
      setPurchasingAlbumId(null);
    },
    [albums]
  );

  const handleOpenAlbum = useCallback(async (albumId: string) => {
    const token = await getToken();
    try {
      const res = await fetch(`${API_URL}/api/albums/${albumId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const data = await res.json() as { title: string; photos: AlbumPhoto[] };
      setViewerAlbum({ title: data.title, photos: data.photos });
    } catch { /* non-fatal */ }
  }, [getToken]);

  const handlePurchaseAlbum = useCallback(async (albumId: string) => {
    if (purchasingAlbumId) return;
    setPurchasingAlbumId(albumId);
    const token = await getToken();
    try {
      const res = await fetch(`${API_URL}/api/albums/${albumId}/purchase`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        setPurchasingAlbumId(null);
        return;
      }
      const data = await res.json() as { photos: AlbumPhoto[] };
      setAlbums((prev) =>
        prev.map((a) => a.id === albumId ? { ...a, hasPurchased: true } : a)
      );
      const album = albums.find((a) => a.id === albumId);
      if (album) {
        setViewerAlbum({ title: album.title, photos: data.photos });
      }
    } catch { /* non-fatal */ } finally {
      setPurchasingAlbumId(null);
    }
  }, [purchasingAlbumId, getToken, albums]);

  // Voice state
  const [showVoiceConfirm, setShowVoiceConfirm] = useState(false);
  const [activeVoiceSession, setActiveVoiceSession] = useState(false);

  return (
    <div className="flex h-full overflow-hidden relative">
      {/* Voice confirmation modal */}
      {showVoiceConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,.6)" }}
          onClick={(e) => e.target === e.currentTarget && setShowVoiceConfirm(false)}
        >
          <div style={{
            background: "var(--color-bg-surface)", border: "1px solid var(--color-border)",
            borderRadius: 12, padding: 28, width: 360,
          }}>
            <h3 style={{ color: "var(--color-text-1)", fontSize: 16, marginBottom: 8 }}>
              Iniciar áudio ao vivo?
            </h3>
            <p style={{ color: "var(--color-text-3)", fontSize: 13, marginBottom: 24 }}>
              Todos os membros online serão notificados.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowVoiceConfirm(false)}
                style={{
                  padding: "8px 16px", borderRadius: 6, fontSize: 13,
                  background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)",
                  color: "#F0F4FA", cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => { setActiveVoiceSession(true); setShowVoiceConfirm(false); }}
                style={{
                  padding: "8px 16px", borderRadius: 6, fontSize: 13,
                  background: "#4A9EFF", border: "none",
                  color: "#fff", cursor: "pointer", fontWeight: 600,
                }}
              >
                Iniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Center column */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopicHeader
          topic={topic}
          isConnected={isConnected}
          onNewTopic={() => setNewTopicOpen(true)}
          onMarkDecision={() => setDecisionsOpen(true)}
          onRequestSummary={handleRequestSummary}
          {...(pinnedMessage ? { pinnedMessage } : {})}
          onUnpin={() => void handleUnpin()}
          onScrollToPin={handleScrollToPin}
          isSearchOpen={isSearchOpen}
          searchQuery={searchQuery}
          onSearchOpen={handleSearchOpen}
          onSearchClose={handleSearchClose}
          onSearchChange={handleSearchChange}
          isHost={isAdmin}
          activeVoiceSession={activeVoiceSession}
          onStartVoice={() => setShowVoiceConfirm(true)}
          onEndVoice={() => setActiveVoiceSession(false)}
        />

        {isSearchOpen ? (
          <SearchResultsPanel
            query={searchQuery}
            results={searchResults}
            isLoading={isSearchLoading}
            onResultClick={handleResultClick}
          />
        ) : (
          <TopicChatArea
            topicId={topicId}
            topicTitle={topic.title}
            communityId={communityId}
            initialMessages={initialMessages}
            initialSummary={initialSummary}
            onConnectionChange={setIsConnected}
            onMount={handleMount}
            onSummaryChange={setSummary}
            isAdmin={isAdmin}
            canSave={canSave}
            onPin={(msg) => void handlePin(msg)}
            onAlbumPublished={handleAlbumPublished}
            onAlbumPurchased={handleAlbumPurchased}
            {...(isAdmin ? { onCreateAlbum: () => setAlbumCreateOpen(true) } : {})}
            {...(highlightedMessageId ? { highlightedMessageId } : {})}
          />
        )}
      </div>

      {/* Right panel */}
      <TopicList
        communityId={communityId}
        {...(topic.communityName ? { communityName: topic.communityName } : {})}
        topics={initialTopics}
        activeTopic={topicId}
        topicSummary={summary}
        albums={albums}
        isOwnerOrMod={isAdmin}
        onOpenAlbum={(id) => void handleOpenAlbum(id)}
        onPurchaseAlbum={(id) => void handlePurchaseAlbum(id)}
        onCreateAlbum={() => setAlbumCreateOpen(true)}
        purchasingAlbumId={purchasingAlbumId}
      />

      {/* Modals */}
      {newTopicOpen && (
        <NewTopicModal
          communityId={communityId}
          onClose={() => setNewTopicOpen(false)}
        />
      )}
      {decisionsOpen && (
        <DecisionsModal
          summary={summary}
          onClose={() => setDecisionsOpen(false)}
        />
      )}
      {albumCreateOpen && (
        <AlbumCreateModal
          communityId={communityId}
          topicId={topicId}
          getToken={getToken}
          onClose={() => setAlbumCreateOpen(false)}
          onCreated={(albumId) => {
            // Refresh albums list after creation
            void (async () => {
              const token = await getToken();
              try {
                const res = await fetch(`${API_URL}/api/communities/${communityId}/albums?topicId=${topicId}`, {
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (res.ok) setAlbums(await res.json() as AlbumCardData[]);
              } catch { /* non-fatal */ }
              void albumId; // suppress unused warning
            })();
          }}
        />
      )}
      {viewerAlbum && (
        <AlbumViewer
          albumTitle={viewerAlbum.title}
          photos={viewerAlbum.photos}
          onClose={() => setViewerAlbum(null)}
        />
      )}

    </div>
  );
}
