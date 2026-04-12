import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AcceptInviteClient } from "./AcceptInviteClient";

interface Props {
  params: Promise<{ code: string }>;
}

interface InviteData {
  code: string;
  community: {
    id: string;
    name: string;
    description: string | null;
  };
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
}

// NEXT_PUBLIC_API_URL is baked at build time — safe to use server-side too.
// For Railway private networking set INTERNAL_API_URL on the web service.
const API_URL =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

export default async function InvitePage({ params }: Props) {
  const { code } = await params;

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/invites/${code}`, { cache: "no-store" });
  } catch {
    return <ServiceUnavailable />;
  }

  if (!res.ok) {
    return <NotFound status={res.status} />;
  }

  const invite = await res.json() as InviteData;

  // If already authenticated, try to accept immediately
  const { userId, getToken } = await auth();
  if (userId) {
    try {
      const token = await getToken();
      const acceptRes = await fetch(`${API_URL}/api/invites/${invite.code}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token!}` },
        cache: "no-store",
      });
      if (acceptRes.ok) {
        const data = await acceptRes.json() as { communityId: string };
        redirect(`/communities/${data.communityId}`);
      }
    } catch {
      // API unreachable — fall through to show manual accept button
    }
  }

  return (
    <AcceptInviteClient
      invite={invite}
      isAuthenticated={!!userId}
      code={invite.code}
    />
  );
}

// ─── Error states ─────────────────────────────────────────────────────────────

function NotFound({ status }: { status: number }) {
  const isGone = status === 410;
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-page p-4">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-4">🔗</p>
        <h1 className="text-xl font-bold text-text-1 mb-2">
          {isGone ? "Convite inválido" : "Convite não encontrado"}
        </h1>
        <p className="text-text-3 text-sm">
          {isGone
            ? "Este link expirou ou atingiu o limite de usos."
            : "Este link de convite não existe."}
        </p>
      </div>
    </div>
  );
}

function ServiceUnavailable() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-page p-4">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-4">🔗</p>
        <h1 className="text-xl font-bold text-text-1 mb-2">Serviço indisponível</h1>
        <p className="text-text-3 text-sm">
          Não foi possível verificar o convite. Tente novamente em instantes.
        </p>
      </div>
    </div>
  );
}
