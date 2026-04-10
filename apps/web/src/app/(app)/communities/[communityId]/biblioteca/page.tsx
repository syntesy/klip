import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface ContentItem {
  id: string;
  title: string;
  summary: string;
  accessLevel: "free" | "premium";
  locked: boolean;
  topicId: string;
  contentIdeas: { type: string; title: string; description: string }[];
  createdBy: string;
  createdAt: string;
  publishedAt: string;
}

async function apiFetch(path: string, token: string) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `${days} dias atrás`;
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

interface Props {
  params: Promise<{ communityId: string }>;
}

export default async function BibliotecaPage({ params }: Props) {
  const { communityId } = await params;

  const { getToken } = await auth();
  const token = await getToken();
  if (!token) notFound();

  const [items, memberData] = await Promise.all([
    apiFetch(`/api/extrair/biblioteca/${communityId}`, token),
    apiFetch(`/api/communities/${communityId}/me`, token),
  ]);

  const contents: ContentItem[] = items ?? [];
  const userRole: string = (memberData as { role?: string } | null)?.role ?? "member";
  const isPremium = userRole === "owner" || userRole === "moderator";

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-bg-page">
      <div className="max-w-3xl mx-auto w-full px-4 py-4 md:px-8 md:py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-[10px] mb-[6px]">
            <span style={{ color: "var(--color-blue-bright)", fontSize: 22 }}>✦</span>
            <h1
              className="text-[26px] font-bold text-text-1"
              style={{ letterSpacing: "-0.5px" }}
            >
              Sala Premium
            </h1>
          </div>
          <p className="text-[14px] text-text-3">
            Conteúdo exclusivo gerado das conversas desta comunidade
          </p>
        </div>

        {/* Empty state */}
        {contents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "var(--color-blue-dim)", border: "1px solid var(--color-blue-border)" }}
            >
              <span style={{ fontSize: 22, color: "var(--color-blue-bright)" }}>✦</span>
            </div>
            <p className="text-[15px] font-semibold text-text-2 mb-[6px]">
              Nenhum conteúdo publicado ainda
            </p>
            {isPremium ? (
              <p className="text-[13px] text-text-3 max-w-xs">
                Use o botão <strong>✦ Extrair</strong> em qualquer mensagem do tópico para gerar e publicar conteúdo.
              </p>
            ) : (
              <p className="text-[13px] text-text-3 max-w-xs">
                Os moderadores ainda não publicaram nenhum conteúdo nesta sala.
              </p>
            )}
          </div>
        )}

        {/* Content grid */}
        <div className="flex flex-col gap-4">
          {contents.map((item) => (
            <div
              key={item.id}
              className="rounded-[14px] p-5"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border)",
                borderLeft: item.locked
                  ? "3px solid var(--color-blue-bright)"
                  : "3px solid var(--color-green)",
              }}
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-3 mb-[8px]">
                <div className="flex items-center gap-[8px] flex-wrap">
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.08em] px-[8px] py-[2px] rounded-[6px]"
                    style={item.accessLevel === "premium" ? {
                      background: "var(--color-blue-dim)",
                      color: "var(--color-blue-bright)",
                      border: "1px solid var(--color-blue-border)",
                    } : {
                      background: "var(--color-green-dim)",
                      color: "var(--color-green)",
                      border: "1px solid var(--color-green-border)",
                    }}
                  >
                    {item.accessLevel === "premium" ? "✦ Premium" : "Gratuito"}
                  </span>
                  {item.locked && (
                    <span className="text-[10px] text-text-3">🔒 Acesso restrito</span>
                  )}
                </div>
                <span className="text-[11px] text-text-3 shrink-0">
                  {timeAgo(item.publishedAt)}
                </span>
              </div>

              {/* Title */}
              <h2 className="text-[15px] font-bold text-text-1 mb-[6px]" style={{ letterSpacing: "-0.2px" }}>
                {item.title}
              </h2>

              {/* Summary */}
              <p className="text-[13px] text-text-2 leading-[1.6] mb-[12px]">
                {item.summary}
              </p>

              {/* Content ideas (visible if not locked) */}
              {!item.locked && item.contentIdeas.length > 0 && (
                <div className="flex flex-col gap-[6px] mb-[12px]">
                  {item.contentIdeas.map((idea, i) => (
                    <div
                      key={i}
                      className="flex gap-[8px] rounded-[8px] px-[10px] py-[8px]"
                      style={{
                        background: "var(--color-bg-subtle)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <span className="text-[11px] font-semibold text-text-2">{idea.title}</span>
                      <span className="text-[11px] text-text-3 leading-[1.4]">— {idea.description}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Locked CTA */}
              {item.locked && (
                <div
                  className="rounded-[8px] px-[14px] py-[10px] flex items-center justify-between"
                  style={{
                    background: "var(--color-blue-dim)",
                    border: "1px solid var(--color-blue-border)",
                  }}
                >
                  <span className="text-[12px] text-text-2">
                    Faça upgrade para acessar o conteúdo completo
                  </span>
                  <button
                    type="button"
                    className="text-[12px] font-semibold shrink-0"
                    style={{ color: "var(--color-blue-bright)" }}
                  >
                    Fazer upgrade →
                  </button>
                </div>
              )}

              {/* Footer link */}
              <div className="mt-3">
                <Link
                  href={`/communities/${communityId}/topics/${item.topicId}`}
                  className="text-[11px] no-underline"
                  style={{ color: "var(--color-text-3)" }}
                >
                  Ver conversa original →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
