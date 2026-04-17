import { auth } from "@clerk/nextjs/server";
import { MobileLayout } from "@/components/layout/MobileLayout";
import type { CommunityWithMeta } from "@/components/layout/Sidebar";

export const dynamic = "force-dynamic";

const API_URL = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetchCommunities(): Promise<CommunityWithMeta[]> {
  try {
    const { getToken } = await auth();
    const token = await getToken();
    if (!token) return [];

    const res = await fetch(`${API_URL}/api/communities`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[fetchCommunities] ${res.status}: ${body.slice(0, 200)}`);
      return [];
    }
    const data = await res.json() as CommunityWithMeta[];
    return data.map((c) => ({ ...c, hasUnread: false }));
  } catch (err) {
    console.error("[fetchCommunities] network error:", err);
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
