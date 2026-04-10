import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

interface KlipWithMessage {
  klip: {
    id: string;
    userId: string;
    messageId: string;
    note: string | null;
    createdAt: string;
  };
  message: {
    id: string;
    topicId: string;
    communityId: string;
    authorId: string;
    content: string;
    createdAt: string;
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetchKlips(): Promise<KlipWithMessage[]> {
  try {
    const { getToken } = await auth();
    const token = await getToken();
    if (!token) return [];

    const res = await fetch(`${API_URL}/api/klips`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json() as Promise<KlipWithMessage[]>;
  } catch {
    return [];
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

export default async function KlipsPage() {
  const klips = await fetchKlips();

  return (
    <div className="flex flex-col h-full p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-1">Meus Klips</h1>
        <p className="text-text-2 mt-1">
          Mensagens que você salvou para referência futura
        </p>
      </div>

      {klips.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <div className="w-12 h-12 rounded-xl bg-green/10 flex items-center justify-center mb-4">
            <span className="text-green text-xl">◆</span>
          </div>
          <p className="font-medium text-text-2">Nenhum klip ainda</p>
          <p className="text-sm text-text-3 mt-1">
            Salve mensagens importantes clicando em &ldquo;Klipar&rdquo; em qualquer mensagem
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-w-2xl">
          {klips.map(({ klip, message }) => (
            <div
              key={klip.id}
              className="bg-bg-surface rounded-xl border border-border p-4"
              style={{ borderLeft: "3px solid var(--color-green)" }}
            >
              <p className="text-[13.5px] text-text-2 leading-[1.6] mb-2">
                {message.content}
              </p>
              {klip.note && (
                <p className="text-[12px] text-text-3 italic mb-2">
                  Nota: {klip.note}
                </p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-3">
                  {timeAgo(klip.createdAt)}
                </span>
                <Link
                  href={`/communities/${message.communityId}/topics/${message.topicId}`}
                  className="text-[11px] text-blue hover:underline"
                >
                  Ver no tópico →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
