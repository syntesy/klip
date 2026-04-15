import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import postgres from "postgres";

const ADMIN_USER_ID = process.env.ADMIN_CLERK_USER_ID;

function fmt(date: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function fmtBRL(value: string | null) {
  const n = parseFloat(value ?? "0");
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(isNaN(n) ? 0 : n);
}

export default async function AdminPage() {
  const { userId } = await auth();
  if (!ADMIN_USER_ID || userId !== ADMIN_USER_ID) redirect("/");

  const sql = postgres(process.env.DATABASE_URL!);

  type CountRow = { count: number };
  type RevenueRow = { total: string | null };
  type CommunityRow = { id: string; name: string; slug: string; created_at: string };
  type PurchaseRow = { id: string; user_id: string; album_id: string; amount_paid: string; purchased_at: string };

  const [
    communitiesRes, topicsRes, messagesRes, membersRes, recentCommunities,
  ] = await Promise.all([
    sql<CountRow[]>`SELECT COUNT(*)::int AS count FROM communities`,
    sql<CountRow[]>`SELECT COUNT(*)::int AS count FROM topics`,
    sql<CountRow[]>`SELECT COUNT(*)::int AS count FROM messages`,
    sql<CountRow[]>`SELECT COUNT(*)::int AS count FROM community_members`,
    sql<CommunityRow[]>`SELECT id, name, slug, created_at FROM communities ORDER BY created_at DESC LIMIT 5`,
  ]);

  // Album tables may not exist yet in production (pending migration)
  let totalAlbums = 0, totalPurchases = 0, revenue: string | null = null;
  let recentPurchases: PurchaseRow[] = [];
  try {
    const [albumsRes, purchasesRes, revenueRes, purchasesListRes] = await Promise.all([
      sql<CountRow[]>`SELECT COUNT(*)::int AS count FROM photo_albums WHERE status = 'published'`,
      sql<CountRow[]>`SELECT COUNT(*)::int AS count FROM album_purchases`,
      sql<RevenueRow[]>`SELECT SUM(amount_paid)::text AS total FROM album_purchases`,
      sql<PurchaseRow[]>`SELECT id, user_id, album_id, amount_paid::text, purchased_at FROM album_purchases ORDER BY purchased_at DESC LIMIT 5`,
    ]);
    totalAlbums    = albumsRes[0]?.count ?? 0;
    totalPurchases = purchasesRes[0]?.count ?? 0;
    revenue        = revenueRes[0]?.total ?? null;
    recentPurchases = purchasesListRes;
  } catch {
    // Tables don't exist yet — migration pending
  }

  const totalCommunities = communitiesRes[0]?.count ?? 0;
  const totalTopics      = topicsRes[0]?.count ?? 0;
  const totalMessages    = messagesRes[0]?.count ?? 0;
  const totalMembers     = membersRes[0]?.count ?? 0;

  await sql.end();

  const today = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const card = (label: string, value: string | number) => (
    <div
      style={{
        backgroundColor: "#0f1e35",
        border: "1px solid #1a2e4a",
        borderRadius: 14,
        padding: "20px 24px",
      }}
    >
      <p style={{ color: "#6B8BAF", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
        {label}
      </p>
      <p style={{ color: "#FFFFFF", fontSize: 32, fontWeight: 700, marginTop: 6, marginBottom: 0 }}>
        {value}
      </p>
    </div>
  );

  const externalLink = (href: string, label: string) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: "#4A9EFF", fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}
    >
      <span style={{ opacity: 0.5 }}>→</span> {label}
    </a>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0B1628",
        color: "#FFFFFF",
        fontFamily: "var(--font-display, Inter, system-ui, sans-serif)",
        padding: "32px 24px",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", margin: 0 }}>
          <span style={{ color: "#4A9EFF" }}>klip</span>{" "}
          <span style={{ color: "#6B8BAF", fontWeight: 400 }}>admin</span>
        </h1>
        <span style={{ color: "#6B8BAF", fontSize: 13 }}>Hoje · {today}</span>
      </div>

      {/* STATUS */}
      <Section label="Status do App">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <StatusCard label="App online" href="https://digitalklip.com" color="#22C98A" pulse />
          <StatusCard label="Sentry (erros)" href="https://syntesy.sentry.io" color="#4A9EFF" />
          <StatusCard label="Better Stack (uptime)" href="https://betterstack.com/team/monitors" color="#4A9EFF" />
        </div>
      </Section>

      {/* PRODUTO */}
      <Section label="Produto">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {card("Comunidades", totalCommunities ?? 0)}
          {card("Tópicos", totalTopics ?? 0)}
          {card("Mensagens", totalMessages ?? 0)}
          {card("Membros", totalMembers ?? 0)}
        </div>
      </Section>

      {/* ÁLBUNS PREMIUM */}
      <Section label="Álbuns Premium">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {card("Álbuns publicados", totalAlbums ?? 0)}
          {card("Compras", totalPurchases ?? 0)}
          {card("Receita total", fmtBRL(revenue ?? null))}
        </div>
      </Section>

      {/* LINKS RÁPIDOS */}
      <Section label="Links Rápidos">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {externalLink("https://syntesy.sentry.io", "Sentry (erros)")}
          {externalLink("https://logs.betterstack.com", "Better Stack (logs)")}
          {externalLink("https://plausible.io/digitalklip.com", "Plausible (tráfego)")}
          {externalLink("https://supabase.com/dashboard/project/shnitursjfwpmbaihaoy", "Supabase (banco)")}
          {externalLink("https://railway.app", "Railway (infra)")}
          {externalLink("https://dashboard.clerk.com", "Clerk (usuários)")}
        </div>
      </Section>

      {/* ÚLTIMAS COMUNIDADES */}
      <Section label="Últimas Comunidades Criadas">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "#6B8BAF" }}>
              <Th>Nome</Th>
              <Th>Criada em</Th>
              <Th>Handle</Th>
            </tr>
          </thead>
          <tbody>
            {recentCommunities.length === 0 && (
              <tr><td colSpan={3} style={{ color: "#6B8BAF", padding: "12px 0" }}>Nenhuma comunidade ainda.</td></tr>
            )}
            {recentCommunities.map((c: CommunityRow) => (
              <tr key={c.id} style={{ borderTop: "1px solid #1a2e4a" }}>
                <Td>{c.name}</Td>
                <Td>{fmt(c.created_at)}</Td>
                <Td style={{ color: "#6B8BAF" }}>/{c.slug}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* ÚLTIMAS COMPRAS */}
      <Section label="Últimas Compras de Álbum">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "#6B8BAF" }}>
              <Th>User ID</Th>
              <Th>Álbum ID</Th>
              <Th>Valor</Th>
              <Th>Data</Th>
            </tr>
          </thead>
          <tbody>
            {recentPurchases.length === 0 && (
              <tr><td colSpan={4} style={{ color: "#6B8BAF", padding: "12px 0" }}>Nenhuma compra ainda.</td></tr>
            )}
            {recentPurchases.map((p: PurchaseRow) => (
              <tr key={p.id} style={{ borderTop: "1px solid #1a2e4a" }}>
                <Td style={{ color: "#6B8BAF", fontFamily: "monospace", fontSize: 11 }}>{p.user_id.slice(0, 16)}…</Td>
                <Td style={{ color: "#6B8BAF", fontFamily: "monospace", fontSize: 11 }}>{p.album_id.slice(0, 16)}…</Td>
                <Td style={{ color: "#22C98A" }}>{fmtBRL(p.amount_paid)}</Td>
                <Td>{fmt(p.purchased_at)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <p style={{ color: "#6B8BAF", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, marginTop: 0 }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function StatusCard({ label, href, color, pulse }: { label: string; href: string; color: string; pulse?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        backgroundColor: "#0f1e35",
        border: "1px solid #1a2e4a",
        borderRadius: 14,
        padding: "16px 20px",
        textDecoration: "none",
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      <span style={{ position: "relative", display: "inline-flex", width: 10, height: 10, flexShrink: 0 }}>
        {pulse && (
          <span
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              backgroundColor: color,
              opacity: 0.4,
              animation: "ping 1.5s cubic-bezier(0,0,.2,1) infinite",
            }}
          />
        )}
        <span style={{ position: "relative", borderRadius: "50%", width: 10, height: 10, backgroundColor: color, display: "inline-block" }} />
      </span>
      {label}
    </a>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "8px 0", fontWeight: 500, fontSize: 11 }}>{children}</th>;
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: "10px 0", ...style }}>{children}</td>;
}
