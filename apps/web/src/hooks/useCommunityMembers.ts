"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface CommunityMember {
  userId: string;
  role: "owner" | "moderator" | "member";
  name?: string;
}

export function useCommunityMembers(
  communityId: string | undefined,
  getToken?: () => Promise<string | null>
) {
  const [members, setMembers] = useState<CommunityMember[]>([]);

  useEffect(() => {
    if (!communityId) return;
    let cancelled = false;

    async function load() {
      const token = getToken ? await getToken() : null;
      const res = await fetch(`${API_URL}/api/communities/${communityId}/members`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).catch(() => null);
      if (!res?.ok || cancelled) return;
      const data = await res.json() as CommunityMember[];
      if (!cancelled) setMembers(data);
    }

    void load();
    return () => { cancelled = true; };
  }, [communityId]); // eslint-disable-line react-hooks/exhaustive-deps

  return members;
}
