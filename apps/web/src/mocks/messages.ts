import type { MessageFeedProps } from "@/components/chat/MessageFeed";

// ─── Relative timestamps from "now" ──────────────────────────────────────────
function minsAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 1000);
}

// ─── Mock messages ────────────────────────────────────────────────────────────
export const MOCK_MESSAGES: MessageFeedProps["messages"] = [
  {
    id: "msg-1",
    topicId: "topic-abc",
    authorId: "user_rafael",
    content:
      "Pessoal, precisamos definir a estratégia de lançamento. **Minha proposta:** começar com beta fechado para 50 usuários selecionados.",
    isEdited: false,
    isKlipped: false,
    createdAt: minsAgo(45),
    updatedAt: minsAgo(45),
    deletedAt: null,
    author: { id: "user_rafael", name: "Rafael Mendes" },
  },
  {
    id: "msg-2",
    topicId: "topic-abc",
    authorId: "user_rafael",
    content:
      "Assim conseguimos coletar feedback *qualitativo* antes de abrir para o público geral.",
    isEdited: false,
    isKlipped: false,
    createdAt: minsAgo(44),       // mesmo autor, < 3 min → mesmo grupo
    updatedAt: minsAgo(44),
    deletedAt: null,
    author: { id: "user_rafael", name: "Rafael Mendes" },
  },
  {
    id: "msg-3",
    topicId: "topic-abc",
    authorId: "user_camila",
    content:
      "Concordo com o beta fechado. Preciso que a feature de **resumo IA** esteja funcional antes do lançamento — é o diferencial principal.",
    isEdited: false,
    isKlipped: false,
    createdAt: minsAgo(38),
    updatedAt: minsAgo(38),
    deletedAt: null,
    author: { id: "user_camila", name: "Camila Torres" },
  },
  {
    id: "msg-4",
    topicId: "topic-abc",
    authorId: "user_camila",
    content:
      "Decisão: lançar beta privado na semana que vem com as features core. Klips e resumo IA são obrigatórios no MVP.",
    isEdited: false,
    isKlipped: true,              // ← klipado pela IA
    createdAt: minsAgo(37),       // < 3 min → mesmo grupo que msg-3
    updatedAt: minsAgo(37),
    deletedAt: null,
    author: { id: "user_camila", name: "Camila Torres" },
  },
  {
    id: "msg-5",
    topicId: "topic-abc",
    authorId: "user_marcel",
    content: "Esse comentário foi removido.",
    isEdited: false,
    isKlipped: false,
    createdAt: minsAgo(12),
    updatedAt: minsAgo(12),
    deletedAt: minsAgo(10),       // ← soft deleted
    author: { id: "user_marcel", name: "Marcel Carvalho" },
  },
];

// ─── Mock topic summary ───────────────────────────────────────────────────────
export const MOCK_TOPIC_SUMMARY: MessageFeedProps["topicSummary"] = {
  content:
    "O time discutiu a estratégia de lançamento do MVP do Klip. Rafael propôs beta fechado com 50 usuários selecionados para coleta de feedback qualitativo. Camila reforçou que o resumo por IA é o diferencial principal e deve estar pronto antes do lançamento.",
  decisions: [
    "Lançar beta privado para 50 usuários na semana que vem",
    "Resumo IA e Klips são features obrigatórias do MVP",
  ],
  generatedAt: minsAgo(8),
};

// ─── Mock typing users ────────────────────────────────────────────────────────
export const MOCK_TYPING_USERS: MessageFeedProps["typingUsers"] = [
  { userId: "user_joao", name: "João" },
];

// ─── Current user ─────────────────────────────────────────────────────────────
export const MOCK_CURRENT_USER_ID = "user_rafael";
