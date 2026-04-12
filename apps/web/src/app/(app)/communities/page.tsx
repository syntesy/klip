import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { NewCommunityButton } from "@/components/communities/NewCommunityButton";

// Paleta de cores para o topo dos cards (derivada do nome)
const CARD_COLORS = [
  "#1249A0", "#0D9B6A", "#7B3FA0", "#B06A00",
  "#0E7490", "#9D174D", "#065F46", "#1E3A5F",
];

function cardColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  return CARD_COLORS[Math.abs(hash) % CARD_COLORS.length]!;
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

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

export default async function CommunitiesPage() {
  const communities = await fetchCommunities();

  return (
    <div className="flex flex-col h-full p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-1">Minhas comunidades</h1>
          <p className="text-text-2 mt-1">Acesse e gerencie suas comunidades</p>
        </div>
        <NewCommunityButton />
      </div>

      {communities.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-bg-surface rounded-xl border border-gray-100 p-6 text-center text-text-3">
            <p className="text-4xl mb-3">🌐</p>
            <p className="font-medium text-text-2">Nenhuma comunidade ainda</p>
            <p className="text-sm mt-1">Crie sua primeira comunidade para começar</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {communities.map((community) => {
            const color = cardColor(community.name);
            const abbr = initials(community.name);
            return (
              <Link
                key={community.id}
                href={`/communities/${community.id}`}
                className="block no-underline rounded-xl overflow-hidden transition-all hover:shadow-md"
                style={{ background: "var(--color-bg-surface)", border: "0.5px solid var(--color-border)" }}
              >
                {/* Faixa colorida no topo */}
                <div style={{ height: 6, background: color }} />
                <div className="p-5">
                  {/* Badge de iniciais + nome */}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="flex items-center justify-center text-[13px] font-bold text-white shrink-0"
                      style={{ width: 38, height: 38, borderRadius: 10, background: color }}
                    >
                      {abbr}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-[14px] font-semibold text-text-1 truncate">{community.name}</h2>
                      <p className="text-[11px] text-text-3 font-mono truncate">/{community.slug}</p>
                    </div>
                  </div>
                  {/* Descrição */}
                  {community.description && (
                    <p className="text-[12.5px] text-text-3 line-clamp-2 leading-[1.5]">{community.description}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
