import { auth, currentUser } from "@clerk/nextjs/server";
import { SavedLibrary } from "@/components/library/SavedLibrary";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetchSavedMessages(token: string) {
  try {
    const res = await fetch(`${API_URL}/api/me/saved-messages?limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function LibraryPage() {
  const { getToken } = await auth();
  const token = await getToken();

  const clerkUser = await currentUser();
  const userPlan = (clerkUser?.publicMetadata?.["plan"] as string | undefined) ?? "starter";
  const canSave = userPlan === "pro" || userPlan === "business";

  const data = canSave && token ? await fetchSavedMessages(token) : null;

  return (
    <SavedLibrary
      canSave={canSave}
      initialItems={data?.items ?? []}
      initialNextCursor={data?.nextCursor ?? null}
      initialTotal={data?.total ?? 0}
    />
  );
}
