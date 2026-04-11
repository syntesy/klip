import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AcceptInviteClient } from "./AcceptInviteClient";

interface Props {
  params: { code: string };
}

interface InviteData {
  code: string;
  community: {
    id: string;
    name: string;
    description: string | null;
    ownerId: string;
  };
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default async function InvitePage({ params }: Props) {
  const { code } = params;

  // Fetch invite data — public endpoint, no auth needed
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/invites/${code}`, { cache: "no-store" });
  } catch {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-page p-4">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">🔗</p>
          <h1 className="text-xl font-bold text-text-1 mb-2">Serviço indisponível</h1>
          <p className="text-text-3 text-sm">Não foi possível verificar o convite. Tente novamente em instantes.</p>
        </div>
      </div>
    );
  }

  if (!res.ok) {
    const status = res.status;
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-page p-4">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">🔗</p>
          <h1 className="text-xl font-bold text-text-1 mb-2">
            {status === 410 ? "Convite inválido" : "Convite não encontrado"}
          </h1>
          <p className="text-text-3 text-sm">
            {status === 410
              ? "Este link expirou ou atingiu o limite de usos."
              : "Este link de convite não existe."}
          </p>
        </div>
      </div>
    );
  }

  const invite = await res.json() as InviteData;

  // If already authenticated, check membership and possibly auto-redirect
  const { userId, getToken } = await auth();
  if (userId) {
    const token = await getToken();
    // Try to accept immediately — if already a member, redirect straight in
    try {
      const acceptRes = await fetch(`${API_URL}/api/invites/${code}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token!}` },
        cache: "no-store",
      });
      if (acceptRes.ok) {
        const data = await acceptRes.json() as { communityId: string };
        redirect(`/communities/${data.communityId}`);
      }
    } catch {
      // API down — fall through to show invite page
    }
  }

  return (
    <AcceptInviteClient
      invite={invite}
      isAuthenticated={!!userId}
      code={code}
    />
  );
}
