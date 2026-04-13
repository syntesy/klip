import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { NewCommunityButton } from "@/components/communities/NewCommunityButton";

interface Community {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string;
}

const API_URL = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetchCommunities(): Promise<Community[]> {
  try {
    const { getToken } = await auth();
    const token = await getToken();
    if (!token) return [];

    const res = await fetch(`${API_URL}/api/communities`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json() as Promise<Community[]>;
  } catch {
    return [];
  }
}

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

// ─── Community Card ───────────────────────────────────────────────────────────

function CommunityCard({ community }: { community: Community }) {
  const color = avatarColor(community.name);
  const abbr = initials(community.name);

  return (
    <Link
      href={`/communities/${community.id}`}
      className="block no-underline transition-all"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-blue-border)",
        borderRadius: 18,
        overflow: "hidden",
      }}
    >
      {/* Banner */}
      <div style={{ height: 6, background: "linear-gradient(90deg, #22C98A, #1249A0)" }} />

      <div style={{ padding: "14px 16px 16px" }}>
        {/* Avatar + nome + badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div
            style={{
              width: 42, height: 42, borderRadius: 12,
              background: color,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 700, color: "#fff",
              flexShrink: 0,
            }}
          >
            {abbr}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-1)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {community.name}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-3)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              /{community.slug}
            </div>
          </div>

          {/* Badge ativo */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "rgba(34,201,138,0.12)",
              border: "1px solid rgba(34,201,138,0.2)",
              borderRadius: 20, padding: "3px 8px",
              flexShrink: 0,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C98A", flexShrink: 0, display: "inline-block" }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: "#22C98A" }}>ativo</span>
          </div>
        </div>

        {/* Stats 3 colunas */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 12 }}>
          {[
            { label: "mensagens", value: "–" },
            { label: "membros", value: "–" },
            { label: "tópicos", value: "–" },
          ].map(({ label, value }, i) => (
            <div
              key={label}
              style={{
                textAlign: "center",
                paddingTop: 8, paddingBottom: 8,
                borderLeft: i > 0 ? "1px solid var(--color-border-mid)" : undefined,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-1)", lineHeight: 1.2 }}>{value}</div>
              <div style={{ fontSize: 10, color: "var(--color-text-3)", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Descrição (se existir, no lugar do pill de tópico) */}
        {community.description && (
          <div
            style={{
              background: "var(--color-blue-dim)",
              border: "1px solid var(--color-blue-border)",
              borderRadius: 8,
              padding: "7px 10px",
              fontSize: 12,
              color: "var(--color-text-2)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {community.description}
          </div>
        )}
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CommunitiesPage() {
  const communities = await fetchCommunities();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px 16px", overflowY: "auto", background: "var(--color-bg-page)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-1)", margin: 0, lineHeight: 1.2 }}>Comunidades</h1>
          <p style={{ fontSize: 12, color: "var(--color-text-3)", margin: "4px 0 0" }}>Gerencie seus espaços</p>
        </div>
        <NewCommunityButton variant="button" />
      </div>

      {/* Lista de cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {communities.map((community) => (
          <CommunityCard key={community.id} community={community} />
        ))}

        {/* Card placeholder — criar nova comunidade */}
        <NewCommunityButton variant="card" />
      </div>
    </div>
  );
}
