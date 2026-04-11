import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { NewTopicButton } from "@/components/communities/NewTopicButton";
import { InviteButton } from "@/components/communities/InviteButton";
import { DeleteCommunityButton } from "@/components/communities/DeleteCommunityButton";

interface Props {
  params: Promise<{ communityId: string }>;
}

interface Community {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface Topic {
  id: string;
  title: string;
  description: string | null;
  status: "active" | "resolved" | "closed";
  isPinned: boolean;
  messageCount: number;
  lastActivityAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function apiFetch(path: string, token: string) {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
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

const STATUS_LABEL = {
  active: "ativo",
  resolved: "resolvido",
  closed: "encerrado",
} as const;

const STATUS_DOT = {
  active: "bg-green-500",
  resolved: "bg-blue-500",
  closed: "bg-gray-400",
} as const;

export default async function CommunityPage({ params }: Props) {
  const { communityId } = await params;

  const { getToken } = await auth();
  const token = await getToken();
  if (!token) notFound();

  const [community, topics] = await Promise.all([
    apiFetch(`/api/communities/${communityId}`, token) as Promise<Community | null>,
    apiFetch(`/api/topics?communityId=${communityId}`, token) as Promise<Topic[] | null>,
  ]);

  if (!community) notFound();

  const topicList = topics ?? [];
  const pinned = topicList.filter((t) => t.isPinned);
  const regular = topicList.filter((t) => !t.isPinned);

  return (
    <div className="flex flex-col h-full p-4 md:p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-1">{community.name}</h1>
          {community.description && (
            <p className="text-text-2 mt-1 text-sm">{community.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <DeleteCommunityButton communityId={communityId} communityName={community.name} />
          <InviteButton communityId={communityId} />
          <NewTopicButton communityId={communityId} />
        </div>
      </div>

      {topicList.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <p className="font-medium text-text-2">Nenhum tópico ainda</p>
          <p className="text-sm text-text-3 mt-1">Crie o primeiro tópico desta comunidade</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {pinned.length > 0 && (
            <section>
              <p className="text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-2">Fixados</p>
              <TopicGrid topics={pinned} communityId={communityId} />
            </section>
          )}
          {regular.length > 0 && (
            <section>
              {pinned.length > 0 && (
                <p className="text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-2 mt-2">Todos os tópicos</p>
              )}
              <TopicGrid topics={regular} communityId={communityId} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function TopicGrid({ topics, communityId }: { topics: Topic[]; communityId: string }) {
  return (
    <div className="flex flex-col gap-2">
      {topics.map((topic) => (
        <Link
          key={topic.id}
          href={`/communities/${communityId}/topics/${topic.id}`}
          className="flex items-start gap-3 bg-bg-surface rounded-xl border border-border p-4 hover:border-blue/40 hover:shadow-sm transition-all no-underline"
        >
          <span className={`mt-[6px] w-[7px] h-[7px] rounded-full shrink-0 ${STATUS_DOT[topic.status]}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {topic.isPinned && <span className="text-[10px] text-text-3">📌</span>}
              <h3 className="text-[14px] font-medium text-text-1 truncate">{topic.title}</h3>
              <span className="text-[10px] text-text-3 shrink-0">{STATUS_LABEL[topic.status]}</span>
            </div>
            {topic.description && (
              <p className="text-[12.5px] text-text-3 line-clamp-1">{topic.description}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-[12px] font-mono text-text-3">{topic.messageCount} msgs</span>
            <span className="text-[11px] text-text-3">{timeAgo(topic.lastActivityAt)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
