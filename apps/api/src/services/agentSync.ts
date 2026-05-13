/**
 * Agent Sync — IA proativa do Klip
 *
 * Responsável pelo Modo Pulso: monitora a saúde da comunidade e
 * dispara consultas/alertas/ações conforme score de engajamento.
 *
 * PRD v2.3, seção 6.3 (D25, D26, D27)
 *
 * STATUS: STUB. Implementação completa na Sprint F.
 * Não importar funções deste módulo em produção até Sprint F.
 */

// ============================================================================
// Types
// ============================================================================

export type PulseState = 'healthy' | 'cooling' | 'critical';

export type PulseTier = 'starter' | 'pro' | 'business';

export interface PulseScore {
  communityId: string;
  score: number; // 0-100
  state: PulseState;
  components: {
    volume: number;       // peso 0.30
    diversity: number;    // peso 0.25
    depth: number;        // peso 0.20
    topContributors: number; // peso 0.25
  };
  computedAt: Date;
}

export interface PulseAlert {
  communityId: string;
  level: 'info' | 'warning' | 'critical';
  message: string;
  triggeredAt: Date;
  acknowledgedAt?: Date;
}

export interface PulseDigest {
  communityId: string;
  period: 'daily' | 'weekly';
  highlights: string[];
  topTopics: string[];
  // Nota: "decisões em aberto" foi removido por D28 (PRD v2.3)
  generatedAt: Date;
}

export interface PulseAction {
  communityId: string;
  type: 'suggest_topic' | 'nudge_member' | 'pin_message';
  payload: Record<string, unknown>;
  requiresApproval: boolean; // sempre true no MVP (Co-piloto deferido pra v3.0)
}

// ============================================================================
// Score Engine (SQL puro — D26)
// ============================================================================

/**
 * Calcula score de Pulso 0-100 em 4 camadas:
 * volume (0.30) + diversidade (0.25) + profundidade (0.20) + top contributors (0.25)
 *
 * TODO Sprint F: implementar query SQL com agregações em activity_log.
 */
export async function computePulseScore(
  _communityId: string,
  _window: '24h' | '7d' = '24h'
): Promise<PulseScore> {
  throw new Error('agentSync.computePulseScore not implemented — Sprint F');
}

// ============================================================================
// Diagnóstico narrativo (LLM com cache 6h — D26)
// ============================================================================

/**
 * Gera diagnóstico em linguagem natural + 3 sugestões de ação.
 * Cache de 6h por communityId para reduzir custo LLM.
 *
 * TODO Sprint F: integrar com Anthropic API + Redis cache.
 */
export async function generatePulseDiagnosis(
  _score: PulseScore
): Promise<{ narrative: string; suggestions: string[] }> {
  throw new Error('agentSync.generatePulseDiagnosis not implemented — Sprint F');
}

// ============================================================================
// Modo Consulta — /klip pulso (D25)
// ============================================================================

/**
 * Handler do comando `/klip pulso` enviado por um Membro/Mod/Dono.
 * Retorna score atual + estado + diagnóstico se disponível por tier.
 *
 * TODO Sprint F: implementar com gates por tier (starter/pro/business).
 */
export async function handlePulseQuery(
  _communityId: string,
  _userId: string,
  _tier: PulseTier
): Promise<PulseScore & { diagnosis?: string }> {
  throw new Error('agentSync.handlePulseQuery not implemented — Sprint F');
}

// ============================================================================
// Modo Alerta — push proativo (D25)
// ============================================================================

/**
 * Dispara alerta quando score cai abaixo de threshold por tier.
 * Pro: tempo real para estado critical. Business: tempo real para tudo.
 *
 * TODO Sprint F: cron + webhook push.
 */
export async function triggerPulseAlert(
  _communityId: string,
  _score: PulseScore
): Promise<PulseAlert | null> {
  throw new Error('agentSync.triggerPulseAlert not implemented — Sprint F');
}

// ============================================================================
// Modo Ação — aciona Agent Ask com aprovação manual (D25)
// ============================================================================

/**
 * Quando Pulso detecta cooling/critical, propõe ação ao Dono.
 * Ação é executada por Agent Ask APÓS aprovação manual.
 * Modo Co-piloto (postagem automática) deferido pra v3.0 por D25.
 *
 * TODO Sprint F: integração com agentAsk + UI de aprovação.
 */
export async function proposePulseAction(
  _communityId: string,
  _score: PulseScore
): Promise<PulseAction | null> {
  throw new Error('agentSync.proposePulseAction not implemented — Sprint F');
}

// ============================================================================
// Resumo diário/semanal (D27)
// ============================================================================

/**
 * Gera digest periódico para o Dono.
 * Starter: semanal. Pro: diário. Business: customizável.
 *
 * Nota: item "decisões em aberto" foi removido por D28 (PRD v2.3).
 *
 * TODO Sprint F: cron job + template de email/notificação.
 */
export async function generatePulseDigest(
  _communityId: string,
  _period: 'daily' | 'weekly',
  _tier: PulseTier
): Promise<PulseDigest> {
  throw new Error('agentSync.generatePulseDigest not implemented — Sprint F');
}
