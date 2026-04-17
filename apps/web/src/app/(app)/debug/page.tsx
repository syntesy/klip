import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

const API_URL = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default async function DebugPage() {
  const steps: { step: string; result: string }[] = [];

  // Step 1: Check env vars
  steps.push({ step: "API_URL", result: API_URL });
  steps.push({ step: "HAS_CLERK_SECRET", result: process.env.CLERK_SECRET_KEY ? `YES (${process.env.CLERK_SECRET_KEY.slice(0, 10)}...)` : "NO" });
  steps.push({ step: "HAS_PK", result: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? `YES (${process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.slice(0, 15)}...)` : "NO" });

  // Step 2: Auth
  try {
    const { userId, getToken } = await auth();
    steps.push({ step: "CLERK_USER_ID", result: userId ?? "NULL" });

    const token = await getToken();
    steps.push({ step: "TOKEN", result: token ? `YES (${token.length} chars)` : "NULL" });

    if (token) {
      // Step 3: Fetch communities
      const url = `${API_URL}/api/communities`;
      steps.push({ step: "FETCH_URL", result: url });

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      steps.push({ step: "RESPONSE_STATUS", result: String(res.status) });
      const body = await res.text();
      steps.push({ step: "RESPONSE_BODY", result: body.slice(0, 500) });
    }
  } catch (err) {
    steps.push({ step: "ERROR", result: String(err) });
  }

  return (
    <div style={{ padding: 32, fontFamily: "monospace", fontSize: 13, color: "#fff" }}>
      <h2>Debug fetchCommunities</h2>
      <table style={{ borderCollapse: "collapse" }}>
        <tbody>
          {steps.map((s, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #333" }}>
              <td style={{ padding: "6px 16px 6px 0", color: "#4A9EFF", fontWeight: 600 }}>{s.step}</td>
              <td style={{ padding: 6, wordBreak: "break-all" }}>{s.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
