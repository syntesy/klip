"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { KlipLogo } from "@/components/ui/KlipLogo";

interface InviteData {
  code: string;
  community: {
    id: string;
    name: string;
    description: string | null;
    // ownerId intentionally omitted — the API does not expose internal Clerk IDs
  };
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
}

interface Props {
  invite: InviteData;
  isAuthenticated: boolean;
  code: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function AcceptInviteClient({ invite, isAuthenticated, code }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { getToken } = useAuth();

  async function handleAccept() {
    if (!isAuthenticated) {
      // Redirect to sign-in, come back after
      router.push(
        `/sign-in?redirect_url=${encodeURIComponent(`/convite/${code}`)}`
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/invites/${code}/accept`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? "Erro ao entrar na comunidade");
        return;
      }

      const data = await res.json() as { communityId: string };
      router.push(`/communities/${data.communityId}`);
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function getAvatarColors(id: string) {
    const hue = parseInt(id.slice(0, 8), 16) % 360;
    return {
      bg: `hsl(${hue}, 65%, 85%)`,
      color: `hsl(${hue}, 65%, 25%)`,
    };
  }

  const avatarStyle = getAvatarColors(invite.community.id);
  const initials = invite.community.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-page p-4">
      {/* Logo */}
      <div className="mb-8">
        <KlipLogo variant="full" size="md" theme="light" />
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-bg-surface rounded-2xl border border-border shadow-lg p-8 text-center">
        {/* Community avatar */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-4"
          style={avatarStyle}
        >
          {initials}
        </div>

        <p className="text-[13px] text-text-3 mb-1">Você foi convidado para</p>
        <h1 className="text-xl font-bold text-text-1 mb-2">
          {invite.community.name}
        </h1>

        {invite.community.description && (
          <p className="text-[13px] text-text-3 mb-6 leading-relaxed">
            {invite.community.description}
          </p>
        )}

        {!invite.community.description && <div className="mb-6" />}

        {error && (
          <p className="text-[12px] text-red-500 mb-4">{error}</p>
        )}

        <button
          type="button"
          onClick={() => void handleAccept()}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-blue text-white font-semibold text-[14px] hover:bg-blue/90 transition-colors disabled:opacity-60"
        >
          {loading
            ? "Entrando…"
            : isAuthenticated
            ? "Entrar na comunidade"
            : "Criar conta para entrar"}
        </button>

        {!isAuthenticated && (
          <p className="text-[12px] text-text-3 mt-3">
            Já tem conta?{" "}
            <a
              href={`/sign-in?redirect_url=${encodeURIComponent(`/convite/${code}`)}`}
              className="text-blue hover:underline"
            >
              Entrar
            </a>
          </p>
        )}
      </div>

      {/* Footer info */}
      {invite.maxUses !== null && (
        <p className="text-[11px] text-text-3 mt-4">
          {invite.useCount} / {invite.maxUses} usos
        </p>
      )}
    </div>
  );
}
