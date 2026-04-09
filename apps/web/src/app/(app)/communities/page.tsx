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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
    <div className="flex flex-col h-full p-8">
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
          {communities.map((community) => (
            <Link
              key={community.id}
              href={`/communities/${community.id}`}
              className="bg-bg-surface rounded-xl border border-border p-6 hover:border-blue/40 hover:shadow-sm transition-all block no-underline"
            >
              <h2 className="text-[15px] font-semibold text-text-1 mb-1">{community.name}</h2>
              {community.description && (
                <p className="text-[13px] text-text-3 line-clamp-2">{community.description}</p>
              )}
              <p className="text-[11px] text-text-3 mt-3 font-mono">/{community.slug}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
