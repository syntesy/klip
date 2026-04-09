"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopicHeader } from "@/components/chat/TopicHeader";
import { TopicChatArea } from "@/components/chat/TopicChatArea";
import { TopicList, type TopicItem } from "@/components/chat/TopicList";
import { MOCK_MESSAGES, MOCK_TOPIC_SUMMARY } from "@/mocks/messages";
import type { CommunityWithMeta } from "@/components/layout/Sidebar";

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_COMMUNITIES: CommunityWithMeta[] = [
  {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    name: "Produto & Design",
    slug: "produto-design",
    description: null,
    ownerId: "user_1",
    hasUnread: true,
  },
  {
    id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    name: "Engenharia",
    slug: "engenharia",
    description: null,
    ownerId: "user_1",
    hasUnread: false,
  },
  {
    id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
    name: "Marketing & Growth",
    slug: "marketing-growth",
    description: null,
    ownerId: "user_2",
    hasUnread: true,
  },
];

const MOCK_TOPICS: TopicItem[] = [
  {
    id: "topic-launch",
    title: "Estratégia de Lançamento",
    messageCount: 24,
    status: "active",
    isPinned: true,
    lastActivityAt: new Date(Date.now() - 10 * 60 * 1000),
  },
  {
    id: "topic-design",
    title: "Design System — v2",
    messageCount: 12,
    status: "active",
    isPinned: false,
    lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: "topic-pricing",
    title: "Decisão de precificação",
    messageCount: 8,
    status: "resolved",
    isPinned: false,
    lastActivityAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    id: "topic-api",
    title: "WebSocket — arquitetura",
    messageCount: 19,
    status: "active",
    isPinned: false,
    lastActivityAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
  },
];

const MOCK_TOPIC = {
  id: "topic-launch",
  title: "Estratégia de Lançamento",
  messageCount: 24,
  participantCount: 5,
  status: "active" as const,
};

// ─── Preview page ─────────────────────────────────────────────────────────────

export default function MessagePreviewPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-bg-page">
      {/* Column 1: Sidebar */}
      <Sidebar communities={MOCK_COMMUNITIES} isOpen={true} />

      {/* Column 2: Topic header + chat area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopicHeader
          topic={MOCK_TOPIC}
          onRequestSummary={() => console.log("summary")}
          onMarkDecision={() => console.log("decision")}
          onNewTopic={() => console.log("new topic")}
        />
        <TopicChatArea
          topicId="topic-launch"
          topicTitle={MOCK_TOPIC.title}
          initialMessages={MOCK_MESSAGES}
          initialSummary={MOCK_TOPIC_SUMMARY ?? null}
        />
      </div>

      {/* Column 3: Topic list */}
      <TopicList
        communityId="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        topics={MOCK_TOPICS}
        activeTopic="topic-launch"
      />
    </div>
  );
}
