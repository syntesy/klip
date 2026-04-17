import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

const API_URL = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default async function DebugPage() {
  const info: Record<string, string> = {};

  info["API_URL"] = API_URL;
  info["HAS_CLERK_SK"] = process.env.CLERK_SECRET_KEY ? `yes (${process.env.CLERK_SECRET_KEY.length} chars)` : "NO!";
  info["HAS_CLERK_PK"] = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? "yes" : "NO!";

  try {
    const { userId, getToken } = await auth();
    info["USER_ID"] = userId ?? "null";
    const token = await getToken();
    info["TOKEN"] = token ? `yes (${token.length} chars)` : "null";

    if (token) {
      const res = await fetch(`${API_URL}/api/communities`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      info["API_STATUS"] = String(res.status);
      const body = await res.text();
      info["API_BODY"] = body.slice(0, 300);
    }
  } catch (e: any) {
    info["ERROR"] = e?.message ?? String(e);
  }

  return (
    <pre style={{ padding: 32, color: "#fff", fontSize: 14, whiteSpace: "pre-wrap" }}>
      {JSON.stringify(info, null, 2)}
    </pre>
  );
}
