import { auth } from "@clerk/nextjs/server";
import { MobileLayout } from "@/components/layout/MobileLayout";
import type { CommunityWithMeta } from "@/components/layout/Sidebar";

export const dynamic = "force-dynamic";

const API_URL = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetchCommunities(): Promise<CommunityWithMeta[]> {
  try {
    const { getToken } = await auth();
    const token = await getToken();
    if (!token) { console.error("[fetchCommunities] no token"); return []; }

    const url = `${API_URL}/api/communities`;
    console.log("[fetchCommunities] fetching", url);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) { console.error("[fetchCommunities] API error", res.status, await res.text()); return []; }
    const data = await res.json() as CommunityWithMeta[];
    return data.map((c) => ({ ...c, hasUnread: false }));
  } catch (e) {
    console.error("[fetchCommunities] exception", e);
    return [];
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const communities = await fetchCommunities();

  return (
    <MobileLayout communities={communities}>
      {children}
    </MobileLayout>
  );
}
