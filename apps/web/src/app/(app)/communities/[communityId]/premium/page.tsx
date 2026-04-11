import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { PremiumPageClient } from "@/components/premium/PremiumPageClient";

interface Props {
  params: Promise<{ communityId: string }>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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

export default async function PremiumPage({ params }: Props) {
  const { communityId } = await params;

  const { getToken } = await auth();
  const token = await getToken();
  if (!token) notFound();

  const [premiumData, memberData, communityData] = await Promise.all([
    apiFetch(`/api/premium/${communityId}`, token),
    apiFetch(`/api/communities/${communityId}/me`, token),
    apiFetch(`/api/communities/${communityId}`, token),
  ]);

  if (!communityData) notFound();

  const userRole: string = (memberData as { role?: string } | null)?.role ?? "member";
  const canManage = userRole === "owner" || userRole === "moderator";

  return (
    <PremiumPageClient
      communityId={communityId}
      communityName={(communityData as { name: string }).name}
      initialKlips={(premiumData as { klips: unknown[] } | null)?.klips ?? []}
      initialPurchasedIds={(premiumData as { purchasedIds: string[] } | null)?.purchasedIds ?? []}
      canManage={canManage}
    />
  );
}
