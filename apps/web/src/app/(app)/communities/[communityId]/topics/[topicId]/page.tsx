import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { TopicPageClient } from "@/components/chat/TopicPageClient";
import type { TopicItem } from "@/components/chat/TopicList";
import type { Message } from "@/components/chat/MessageFeed";
import type { TopicMeta } from "@/components/chat/TopicHeader";
import type { TopicSummary } from "@/hooks/useTopicSocket";

interface Props {
  params: { communityId: string; topicId: string };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function apiFetch(path: string, token: string) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function TopicPage({ params }: Props) {
  const { communityId, topicId } = params;

  const { getToken } = await auth();
  const token = await getToken();
  if (!token) notFound();

  const [topicData, topicsData, messagesData, summaryData, memberData] = await Promise.all([
    apiFetch(`/api/topics/${topicId}`, token),
    apiFetch(`/api/topics?communityId=${communityId}`, token),
    apiFetch(`/api/messages?topicId=${topicId}`, token),
    apiFetch(`/api/ai/summary?topicId=${topicId}`, token),
    apiFetch(`/api/communities/${communityId}/me`, token),
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
  };
  const messages: Message[] = (messagesData ?? []).map((m: RawMessage) => ({
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
  }));

  const summary: TopicSummary | null = summaryData
    ? {
        content: summaryData.content,
        decisions: summaryData.decisions ?? [],
        generatedAt: new Date(summaryData.generatedAt),
      }
    : null;

  const userRole: string = (memberData as { role?: string } | null)?.role ?? "member";
  const canExtrair = userRole === "owner" || userRole === "moderator";

  return (
    <TopicPageClient
      communityId={communityId}
      topicId={topicId}
      topic={topic}
      initialTopics={topics}
      initialMessages={messages}
      initialSummary={summary}
      canExtrair={canExtrair}
    />
  );
}
