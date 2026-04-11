import { auth } from "@clerk/nextjs/server";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { MobileApp } from "@/components/layout/MobileApp";
import type { CommunityWithMeta } from "@/components/layout/Sidebar";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetchCommunities(): Promise<CommunityWithMeta[]> {
  try {
    const { getToken } = await auth();
    const token = await getToken();
    if (!token) return [];

    const res = await fetch(`${API_URL}/api/communities`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json() as CommunityWithMeta[];
    return data.map((c) => ({ ...c, hasUnread: false }));
  } catch {
    return [];
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const communities = await fetchCommunities();

  return (
    <>
      {/* Mobile: native app stack */}
      <div className="md:hidden h-[100dvh] overflow-hidden">
        <MobileApp initialCommunities={communities} />
      </div>
      {/* Desktop: sidebar + page content */}
      <div className="hidden md:flex h-[100dvh]">
        <MobileLayout communities={communities}>
          {children}
        </MobileLayout>
      </div>
    </>
  );
}
