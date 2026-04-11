import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@klip/db";
import { invites, communities, communityMembers } from "@klip/db/schema";
import { eq, or, and, sql } from "drizzle-orm";
import { AcceptInviteClient } from "./AcceptInviteClient";

interface Props {
  params: { code: string };
}

// Server-only API URL for the accept call (avoids localhost in production).
// Set INTERNAL_API_URL in Railway if web and api are separate services.
// Falls back to NEXT_PUBLIC_API_URL (baked at build time), then localhost.
const SERVER_API_URL =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

export default async function InvitePage({ params }: Props) {
  const { code } = params;

  // ── 1. Fetch invite directly from DB — no HTTP round-trip ────────────────
  const [invite] = await db
    .select()
    .from(invites)
    .where(or(eq(invites.slug, code), eq(invites.code, code)))
    .limit(1);

  if (!invite) {
    return <NotFound reason="not-found" />;
  }

  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return <NotFound reason="expired" />;
  }

  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
    return <NotFound reason="limit" />;
  }

  const [community] = await db
    .select()
    .from(communities)
    .where(eq(communities.id, invite.communityId))
    .limit(1);

  if (!community) {
    return <NotFound reason="not-found" />;
  }

  // ── 2. If already authenticated, try to accept immediately ───────────────
  const { userId, getToken } = await auth();
  if (userId) {
    // Check membership first (avoids a wasted HTTP call)
    const [existing] = await db
      .select({ id: communityMembers.id })
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, invite.communityId),
          eq(communityMembers.userId, userId)
        )
      )
      .limit(1);

    if (existing) {
      // Already a member — go straight in
      redirect(`/communities/${invite.communityId}`);
    }

    // Not a member yet — call the API to accept (handles the locked transaction
    // and useCount increment; we don't want to duplicate that logic here)
    try {
      const token = await getToken();
      const acceptRes = await fetch(
        `${SERVER_API_URL}/api/invites/${invite.code}/accept`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token!}` },
          cache: "no-store",
        }
      );
      if (acceptRes.ok) {
        redirect(`/communities/${invite.communityId}`);
      }
    } catch {
      // API unreachable — fall through and show the manual accept button
    }
  }

  const inviteData = {
    code: invite.code,
    community: {
      id: community.id,
      name: community.name,
      description: community.description,
    },
    expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
    maxUses: invite.maxUses,
    useCount: invite.useCount,
  };

  return (
    <AcceptInviteClient
      invite={inviteData}
      isAuthenticated={!!userId}
      code={invite.code}
    />
  );
}

// ─── Error states ─────────────────────────────────────────────────────────────

function NotFound({ reason }: { reason: "not-found" | "expired" | "limit" }) {
  const title =
    reason === "not-found" ? "Convite não encontrado" : "Convite inválido";
  const body =
    reason === "not-found"
      ? "Este link de convite não existe."
      : "Este link expirou ou atingiu o limite de usos.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-page p-4">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-4">🔗</p>
        <h1 className="text-xl font-bold text-text-1 mb-2">{title}</h1>
        <p className="text-text-3 text-sm">{body}</p>
      </div>
    </div>
  );
}
