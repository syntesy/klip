import { auth, currentUser } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { TopicPageClient } from "@/components/chat/TopicPageClient";
import type { TopicItem } from "@/components/chat/TopicList";
import type { Message } from "@/components/chat/MessageFeed";
import type { TopicMeta } from "@/components/chat/TopicHeader";
import type { TopicSummary } from "@/hooks/useTopicSocket";

interface Props {
  params: Promise<{ communityId: string; topicId: string }>;
}

const API_URL = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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

export default async function TopicPage({ params }: Props) {
  const { communityId, topicId } = await params;

  const { getToken } = await auth();
  const token = await getToken();
  if (!token) notFound();

  const [topicData, topicsData, messagesData, summaryData, memberData, clerkUser] = await Promise.all([
    apiFetch(`/api/topics/${topicId}`, token),
    apiFetch(`/api/topics?communityId=${communityId}`, token),
    apiFetch(`/api/messages?topicId=${topicId}`, token),
    apiFetch(`/api/ai/summary?topicId=${topicId}`, token),
    apiFetch(`/api/communities/${communityId}/me`, token),
    currentUser(),
  ]);

  if (!topicData) notFound();

  const topic: TopicMeta = {
    id: topicData.id,
    title: topicData.title,
    communityName: topicData.communityName ?? undefined,
    messageCount: topicData.messageCount,
    participantCount: 0,
    status: topicData.status,
  };

  const topics: TopicItem[] = (topicsData ?? []).map((t: TopicItem & { lastActivityAt: string }) => ({
    id: t.id,
    title: t.title,
    messageCount: t.messageCount,
    status: t.status,
    isPinned: t.isPinned,
    lastActivityAt: new Date(t.lastActivityAt),
  }));

  type RawMessage = Message & {
    authorId: string; authorName?: string;
    createdAt: string; updatedAt: string; deletedAt: string | null;
    replyToId?: string | null; replyToAuthorName?: string | null; replyToContent?: string | null;
    savedByCurrentUser?: boolean;
  };
  // messagesData is { messages: RawMessage[], hasPreviousPage, nextCursor } — not a flat array.
  // Using the paginated wrapper shape since cursor pagination was added in the API.
  const rawMessages: RawMessage[] = (messagesData?.messages ?? []) as RawMessage[];
  const messages: Message[] = rawMessages.map((m: RawMessage) => ({
    id: m.id,
    topicId: m.topicId,
    authorId: m.authorId,
    content: m.content,
    isEdited: m.isEdited,
    isKlipped: false,
    createdAt: new Date(m.createdAt),
    updatedAt: new Date(m.updatedAt),
    deletedAt: m.deletedAt ? new Date(m.deletedAt) : null,
    author: { id: m.authorId, name: m.authorName ?? m.authorId },
    replyToId: m.replyToId ?? null,
    replyToAuthorName: m.replyToAuthorName ?? null,
    replyToContent: m.replyToContent ?? null,
    savedByCurrentUser: m.savedByCurrentUser ?? false,
  }));

  const summary: TopicSummary | null = summaryData
    ? {
        content: summaryData.content,
        decisions: summaryData.decisions ?? [],
        generatedAt: new Date(summaryData.generatedAt),
      }
    : null;

  const userRole: string = (memberData as { role?: string } | null)?.role ?? "member";
  const isAdmin = userRole === "owner" || userRole === "moderator";
  const userPlan = (clerkUser?.publicMetadata?.["plan"] as string | undefined) ?? "starter";
  const canSave = userPlan === "pro" || userPlan === "business" || isAdmin;

  return (
    <div className="flex flex-col h-full">
      <TopicPageClient
        communityId={communityId}
        topicId={topicId}
        topic={topic}
        initialTopics={topics}
        initialMessages={messages}
        initialSummary={summary}
        isAdmin={isAdmin}
        canSave={canSave}
      />
    </div>
  );
}
