import { auth } from "@clerk/nextjs/server";
import { MobileLayout } from "@/components/layout/MobileLayout";
import type { CommunityWithMeta } from "@/components/layout/Sidebar";

export const dynamic = "force-dynamic";

const API_URL = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetchCommunities(): Promise<CommunityWithMeta[]> {
  try {
    const { getToken } = await auth();
    const token = await getToken();
    console.log("[fetchCommunities] token:", token ? `${token.slice(0, 20)}...` : "NULL");
    console.log("[fetchCommunities] API_URL:", API_URL);
    if (!token) return [];

    const res = await fetch(`${API_URL}/api/communities`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    console.log("[fetchCommunities] status:", res.status);
    if (!res.ok) {
      const body = await res.text();
      console.log("[fetchCommunities] error body:", body);
      return [];
    }
    const data = await res.json() as CommunityWithMeta[];
    console.log("[fetchCommunities] count:", data.length);
    return data.map((c) => ({ ...c, hasUnread: false }));
  } catch (err) {
    console.error("[fetchCommunities] CATCH:", err);
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
