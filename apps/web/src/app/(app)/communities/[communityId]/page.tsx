import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CommunityActions } from "@/components/communities/CommunityActions";

interface Props {
  params: Promise<{ communityId: string }>;
}

interface Community {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface Topic {
  id: string;
  title: string;
  description: string | null;
  status: "active" | "resolved" | "closed";
  isPinned: boolean;
  messageCount: number;
  lastActivityAt: string;
}

const API_URL = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function apiFetch(path: string, token: string) {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const STATUS_LABEL = {
  active: "ativo",
  resolved: "resolvido",
  closed: "encerrado",
} as const;

const STATUS_COLOR = {
  active: "#22C98A",
  resolved: "#4A9EFF",
  closed: "#5a7a9a",
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#1249A0", "#0D9B6A", "#7B3FA0", "#B06A00",
  "#0E7490", "#9D174D", "#065F46", "#1E3A5F",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CommunityPage({ params }: Props) {
  const { communityId } = await params;

  const { getToken } = await auth();
  const token = await getToken();
  if (!token) notFound();

  const [community, topics] = await Promise.all([
    apiFetch(`/api/communities/${communityId}`, token) as Promise<Community | null>,
    apiFetch(`/api/topics?communityId=${communityId}`, token) as Promise<Topic[] | null>,
  ]);

  if (!community) notFound();

  const topicList = topics ?? [];
  const pinned = topicList.filter((t) => t.isPinned);
  const regular = topicList.filter((t) => !t.isPinned);
  const totalMessages = topicList.reduce((s, t) => s + t.messageCount, 0);

  const color = avatarColor(community.name);
  const abbr = initials(community.name);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", background: "#08111f" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ padding: "16px 16px 0", flexShrink: 0 }}>
        {/* Back link */}
        <Link
          href="/communities"
          style={{ fontSize: 12, color: "#4A9EFF", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 14 }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>‹</span>
          Comunidades
        </Link>

        {/* Comunidade: ícone + nome + slug */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div
            style={{
              width: 44, height: 44, borderRadius: 14,
              background: color,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, fontWeight: 700, color: "#fff",
              flexShrink: 0,
            }}
          >
            {abbr}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#E8EFF8", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {community.name}
            </div>
            <div style={{ fontSize: 12, color: "#6B8BAF", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              /{community.slug}
              {community.description && <span style={{ marginLeft: 6 }}>· {community.description}</span>}
            </div>
          </div>
        </div>

        {/* Ações: Novo tópico + Convidar + ··· */}
        <CommunityActions communityId={communityId} communityName={community.name} />
      </div>

      {/* ── Barra de stats ──────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          background: "#0B1628",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          margin: "14px 0 0",
          flexShrink: 0,
        }}
      >
        {[
          { label: "Mensagens", value: totalMessages > 0 ? String(totalMessages) : "–" },
          { label: "Klips", value: "–" },
          { label: "Decisões", value: "–" },
          { label: "Membros", value: "–" },
        ].map(({ label, value }, i) => (
          <div
            key={label}
            style={{
              textAlign: "center",
              padding: "10px 6px",
              borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.05)" : undefined,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: "#E8EFF8", lineHeight: 1.2 }}>{value}</div>
            <div style={{ fontSize: 9, color: "#6B8BAF", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Lista de tópicos ─────────────────────────────────────────────── */}
      <div style={{ padding: "16px 16px 24px", flex: 1 }}>
        {topicList.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, textAlign: "center", paddingTop: 40 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#8AAAC8" }}>Nenhum tópico ainda</p>
            <p style={{ fontSize: 12, color: "#6B8BAF", marginTop: 4 }}>Crie o primeiro tópico desta comunidade</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Label da seção */}
            <p style={{ fontSize: 11, fontWeight: 600, color: "#6B8BAF", textTransform: "uppercase", letterSpacing: "1.5px", margin: "0 0 4px" }}>
              Tópicos
            </p>

            {/* Fixados */}
            {pinned.map((topic) => (
              <TopicCard key={topic.id} topic={topic} communityId={communityId} />
            ))}

            {/* Regulares */}
            {regular.map((topic) => (
              <TopicCard key={topic.id} topic={topic} communityId={communityId} />
            ))}

            {/* Placeholder criar tópico */}
            <div
              style={{
                border: "1px dashed rgba(255,255,255,0.1)",
                borderRadius: 14,
                padding: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginTop: 4,
              }}
            >
              <span style={{ fontSize: 16, color: "#3D5A7A", lineHeight: 1 }}>+</span>
              <span style={{ fontSize: 12, color: "#6B8BAF" }}>Criar tópico</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TopicCard ────────────────────────────────────────────────────────────────

function TopicCard({ topic, communityId }: { topic: Topic; communityId: string }) {
  return (
    <Link
      href={`/communities/${communityId}/topics/${topic.id}`}
      className="no-underline block transition-all"
      style={{
        background: "#0F1E35",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 14,
        padding: "12px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Status dot */}
        <span
          style={{
            width: 7, height: 7, borderRadius: "50%",
            background: STATUS_COLOR[topic.status],
            flexShrink: 0,
            display: "inline-block",
          }}
        />

        {/* Título + status label */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {topic.isPinned && <span style={{ fontSize: 10 }}>📌</span>}
            <span style={{ fontSize: 14, fontWeight: 600, color: "#E8EFF8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {topic.title}
            </span>
            <span style={{ fontSize: 10, color: "#6B8BAF", flexShrink: 0 }}>
              {STATUS_LABEL[topic.status]}
            </span>
          </div>
          {topic.description && (
            <p style={{ fontSize: 12, color: "#6B8BAF", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {topic.description}
            </p>
          )}
        </div>

        {/* Contagem + tempo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#8AAAC8" }}>{topic.messageCount}</span>
          <span style={{ fontSize: 10, color: "#6B8BAF" }}>{timeAgo(topic.lastActivityAt)}</span>
        </div>
      </div>
    </Link>
  );
}
