import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

interface DecisionSummary {
  id: string;
  content: string;
  topicId: string;
  communityId: string;
  topicTitle: string;
  generatedAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetchDecisions(): Promise<DecisionSummary[]> {
  try {
    const { getToken } = await auth();
    const token = await getToken();
    if (!token) return [];

    const res = await fetch(`${API_URL}/api/ai/decisions`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json() as Promise<DecisionSummary[]>;
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

export default async function DecisionsPage() {
  const decisions = await fetchDecisions();

  return (
    <div className="flex flex-col h-full p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-1">Decisões</h1>
        <p className="text-text-2 mt-1">
          Todas as decisões das suas comunidades
        </p>
      </div>

      {decisions.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
            style={{ background: "var(--color-blue-dim)" }}
          >
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="var(--color-blue)" strokeWidth="1.5" aria-hidden="true">
              <path d="M8 2l1.5 3 3.5.5-2.5 2.5.6 3.5L8 10l-3.1 1.5.6-3.5L3 5.5l3.5-.5z" />
            </svg>
          </div>
          <p className="font-medium text-text-2">Nenhuma decisão ainda</p>
          <p className="text-sm text-text-3 mt-1 max-w-xs">
            As decisões aparecem aqui quando são criadas nos tópicos usando o Resumo IA.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-w-2xl">
          {decisions.map((d) => (
            <div
              key={d.id}
              className="bg-bg-surface rounded-xl border border-border p-4"
              style={{ borderLeft: "3px solid var(--color-blue)" }}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <span
                  className="text-[11px] font-semibold px-[8px] py-[2px] rounded-[6px]"
                  style={{
                    background: "var(--color-blue-dim)",
                    color: "var(--color-blue)",
                    border: "1px solid var(--color-blue-border)",
                  }}
                >
                  {d.topicTitle}
                </span>
                <span className="text-[11px] text-text-3 shrink-0">
                  {timeAgo(d.generatedAt)}
                </span>
              </div>
              <p className="text-[13px] text-text-2 leading-[1.6] line-clamp-3">
                {d.content}
              </p>
              <div className="mt-3">
                <Link
                  href={`/communities/${d.communityId}/topics/${d.topicId}`}
                  className="text-[11px] text-blue hover:underline"
                >
                  Ver tópico →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
