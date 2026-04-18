# Klip — Sessão de Decisões 18/Abril/2026

**Escopo:** Posicionamento estratégico + Arquitetura da Área Premium + Wireframes + Ajustes no Klip em produção
**Status:** Aprovado por Marcel · Pronto para implementação via Claude Code
**Documentos afetados:**
- `klip-prd-v2.md` — seções 1.4, 1.5 e 10.5 expandidas e integradas
- `klip-premium-wireframes.html` — 5 telas navegáveis validadas
- Novo arquivo pro repositório do Klip

---

## 1. Resumo executivo

Esta sessão fechou três blocos de decisão estratégica:

1. **Posicionamento de categoria do Klip** — onliness statement formal, frase-mãe e roadmap de 3 fases de expansão de público
2. **Arquitetura completa da Área Premium** — com cadastro progressivo, 4 tipos de conteúdo no MVP, stack técnico definido (Mux + Stripe Connect)
3. **Wireframes navegáveis aprovados** — 5 telas cobrindo jornada do membro e jornada do criador

Todas as decisões foram **documentadas oficialmente** no `klip-prd-v2.md` (seções 1.4, 1.5 e 10.5 expandida de 50 para 270 linhas).

---

## 2. Posicionamento de categoria

### 2.1 Onliness statement (inegociável)

> **klip é a única plataforma do mundo onde criadores monetizam respostas em vez de cursos.**

Aplicado a pitch, imprensa e posicionamento institucional.

### 2.2 Frase-mãe (ponte para outros públicos)

> **klip é onde conversas viram conhecimento — e conhecimento vira valor.**

Termo "valor" intencionalmente polissêmico:
- Criador — **receita recorrente** via Klips Premium
- Empresa — **histórico auditável** de decisões
- Grupo pessoal — **memória permanente** de conversas

### 2.3 Categoria criada

**Conversation-to-Revenue** (ou *Plataforma de Respostas Monetizadas*)

Três atributos inegociáveis:

1. **Conversa como origem** — produto começa no chat natural, não no conteúdo estruturado
2. **IA como organizador** — sistema transforma caos em ativos descobríveis
3. **Resposta como produto** — o que o criador vende é resposta real a dúvida real

### 2.4 Inimigo estratégico

- **Curso gravado** — produto morto, taxa de conclusão < 15%
- **PDF-isca** — promessa rasa, zero relação
- **Plataforma que transforma criador em editor de vídeo** — Hotmart, Kajabi, Teachable pedem produção; Klip pede conversa

### 2.5 Voz da marca

| Faz assim | Nunca faz |
|---|---|
| "Pare de gravar curso. Comece a conversar." | "Revolucione sua comunidade com IA" |
| "Responda uma vez. Monetize para sempre." | "Potencialize seu engajamento" |
| "O curso morreu. A resposta vive." | "Soluções inovadoras para criadores" |

---

## 3. Roadmap de expansão de públicos

Sequencial, não simultâneo. Foco em quem paga antes de escalar pra quem consome.

| Fase | Período | Target | Mensagem | Preço | Meta MRR |
|---|---|---|---|---|---|
| **1 — Criador profissional** | Mês 1-6 | Infoprodutores, youtubers, consultores (50k-500k seguidores) | *"Pare de gravar curso. Comece a conversar."* | R$97 / R$247 / R$497 | R$20.000 |
| **2 — Especialista independente** | Mês 7-12 | Médicos, advogados, professores, coaches (com audiência) | *"Seu conhecimento tem valor. Não precisa virar curso."* | Mesmo | R$80.000 |
| **3 — Comunidade pessoal** | Ano 2+ | Pais, líderes, voluntários, grupos de estudo, famílias | *"Todo grupo de WhatsApp merece uma versão séria."* | Freemium | R$350.000 |

### 3.1 Princípios inegociáveis

1. **Ordem importa** — não ampliar público antes da meta da fase atual
2. **Produto é o mesmo, mensagem muda** — não criar "Klip Pro" e "Klip Home"
3. **Onliness statement nunca muda** — mesmo na Fase 3, posicionamento estratégico é criador

### 3.2 Guardrail decisório

Para cada decisão de produto/marketing, aplicar o filtro:

> *"Esta decisão fortalece o criador (Fase 1) ou dilui o posicionamento para atender público de Fase 2/3 cedo demais?"*

Se a resposta for "dilui", adiar.

---

## 4. Área Premium — arquitetura de produto

### 4.1 Visão A confirmada (ferramenta fechada)

Decisão travada: **cada comunidade é uma ilha**. Sem rede social entre criadores, sem discover global. Klip é software que o criador usa para monetizar a própria audiência.

### 4.2 Acesso via sidebar (Opção B)

A Área Premium é **subitem da comunidade**, não item global da sidebar.

```
MENU (do membro)
──────────────────────────────
COMUNIDADES
├─ ▼ Mentoria Lançamento
     ├─ ▪ Chat          (28)
     └─ ▪ Área Premium  (7)   ← item ativo Signal Blue

├─ ▶ Copy Tático
├─ ▶ Tráfego Pro

MEU ESPAÇO
└─ ▪ Configurações

[rodapé]
MS  Mateus Silva
```

Decisão de terminologia: **"Chat"** (não "Tópicos") é o nome do subitem, porque é a linguagem do usuário final. "Tópicos" permanece como termo técnico no código.

### 4.3 Sem Biblioteca Pessoal

**Decisão final:** o membro **não tem "Biblioteca Pessoal"** em lugar nenhum do UI. Os klips comprados são acessados diretamente na Área Premium da comunidade onde foram adquiridos, com badge verde **"✓ Seu"** destacando os já pagos no grid único.

### 4.4 Grid único (sem abas)

A Área Premium mostra **todos os klips numa única grade**:
- **Comprados** — badge verde "✓ Seu" + clique abre player
- **Travados** — cadeado + preço + clique abre página de compra

Sem separação em abas "Biblioteca" e "Vitrine". Os estados são auto-explicativos visualmente.

---

## 5. Cadastro progressivo (2 níveis)

Arquitetura de cadastro que reduz fricção no convite e concentra dados obrigatórios só no momento de maior valor.

| Nível | Quando | Dados | O que destrava |
|---|---|---|---|
| **1 — Convidado** | Aceita convite via link | Email apenas | Acessa comunidade, participa do Chat |
| **2 — Comprador** | Primeira compra de klip premium | Nome, CPF, telefone, endereço, pagamento | Pode comprar (agora e sempre) |

### 5.1 Fluxo primeira compra

```
1. Membro clica em klip travado
2. Página de compra (preview + preço + prova social)
3. Clica "Comprar agora"
4. Sistema detecta Nível 1 → redireciona para cadastro progressivo
5. Formulário completo (dados pessoais + endereço + método pagamento)
6. Clica "Finalizar compra" → Stripe Checkout
7. Webhook payment_intent.succeeded libera acesso
8. Modal confirmação: "Parabéns, [Nome]!"
9. Opção: "Voltar pra Área Premium" ou "Assistir agora"
```

### 5.2 Fluxo compras subsequentes

```
1. Clica "Comprar agora" → Stripe Checkout direto (dados salvos)
2. 1 clique de confirmação
3. Acesso liberado
```

---

## 6. Tipos de conteúdo do MVP

| Tipo | Descrição | Tecnologia | Preço sugerido |
|---|---|---|---|
| **Vídeo** | Resposta gravada, tutorial | **Mux** (signed URLs) | R$19,90 — R$97 |
| **Áudio** | Podcast privado, resposta longa | Mux Audio ou S3 | R$7,90 — R$29,90 |
| **Documento (PDF)** | Checklist, template, ebook | S3 + marca d'água dinâmica | R$4,90 — R$29,90 |
| **Texto longo** | Artigo premium aprofundado | Banco relacional nativo | R$4,90 — R$14,90 |

**Adiados para fase 2:** imagem individual, pacote (combo de tipos), galeria independente de Álbum.

---

## 7. Stack técnico da Área Premium

| Camada | Tecnologia |
|---|---|
| Vídeo VOD | **Mux** (encoding, storage, streaming, signed URLs, DRM opcional fase 2) |
| Áudio | Mux Audio ou S3 + Cloudfront |
| PDF | S3 privado + biblioteca de marca d'água dinâmica |
| Pagamento | **Stripe** (PIX, cartão, boleto) |
| Repasse ao criador | **Stripe Connect** com saque automático semanal |
| Gravação in-app | MediaRecorder API (web) + react-native-vision-camera (fase 2 mobile) |
| Webhook de compra | `payment_intent.succeeded` libera acesso |

### 7.1 Custo estimado de infraestrutura

Para 50 criadores ativos (5h conteúdo cada, 50h visualização/mês):

- Mux: ~$200
- Outros: ~$50
- **Total: ~R$1.000/mês**

Com 50 criadores no plano Pro (R$247/mês) = **R$12.350 de receita**. Margem operacional confortável.

---

## 8. Dashboard do Criador

Painel separado e exclusivo para admin da comunidade. Acessado via grupo "Painel do Criador" na sidebar (verde, distinto do resto).

### 8.1 Cards de visão geral (4 métricas)

- **Receita no mês** (destaque Deep Navy) — com delta vs mês anterior
- **Total de vendas**
- **Compradores únicos** (% da comunidade)
- **Ticket médio**

### 8.2 Gráfico de vendas (14 dias)

Barras Signal Blue + dia atual em Pulse Green.

### 8.3 Painel de próximo saque (Stripe Connect)

- Valor líquido disponível
- Data do próximo saque automático (segundas)
- Conta bancária vinculada
- Status de integração

### 8.4 Tabela de Klips Premium

Thumbnail, título, tipo, preço, vendas, receita, status (No ar / Rascunho).

### 8.5 Lista de compradores recentes

Avatar, nome, klip comprado, valor, tempo relativo.

---

## 9. Proteção de conteúdo — 4 camadas

| Técnica | O que faz | Quando aplicar |
|---|---|---|
| Signed URLs | Link expira em 24h | Sempre (padrão) |
| Marca d'água em vídeo | Email do comprador no player | Vídeos > R$30 |
| Marca d'água em PDF | Nome+email embutido no doc | Todos os PDFs |
| DRM (Widevine/FairPlay) | Bloqueia gravação de tela | Business + conteúdo > R$97 |

**Racional:** proteção total não existe. Objetivo é criar **fricção suficiente** para que compartilhamento casual não valha o esforço.

---

## 10. Comissões e repasse

| Plano do criador | Comissão retida pelo Klip |
|---|---|
| Starter (R$97/mês) | 8% |
| Pro (R$247/mês) | 5% |
| Business (R$497/mês) | 2% |

### 10.1 Composição real de venda de R$49,90 (Pro)

| Item | Valor |
|---|---|
| Preço da venda | R$ 49,90 |
| (-) Taxa Stripe (R$0,40 + 3,99%) | -R$ 2,39 |
| (-) Comissão Klip (5%) | -R$ 2,37 |
| **Líquido para o criador** | **R$ 45,14** |

### 10.2 Repasse

- Via Stripe Connect (onboarding único)
- Saque automático **semanal** (toda segunda)
- Saldo = acumulado da semana anterior
- Conta vinculada diretamente pelo criador

---

## 11. Modelo de dados — 5 tabelas

### 11.1 `premium_klips`

Conteúdo premium publicado pelo criador. Tipo, preço, thumbnail, status, contador denormalizado de vendas.

### 11.2 `premium_purchases`

Registros de compra efetivadas. Inclui breakdown: valor pago, líquido ao criador, taxa Stripe, comissão Klip, método de pagamento.

### 11.3 `user_billing_info`

Dados de cobrança do comprador (Nível 2 do cadastro progressivo). CPF, endereço, Stripe customer ID.

### 11.4 `premium_consumption`

Progresso de consumo para exibir "34% concluído" e posição de retomada.

### 11.5 `creator_payouts`

Saques processados via Stripe Connect. IDs das compras incluídas, status, data de pagamento.

**SQL completo no PRD (seção 10.5.10).**

---

## 12. Wireframes aprovados

5 telas navegáveis entregues em HTML único:

1. **Área Premium (Membro)** — grid único, sidebar com Chat + Área Premium + Configurações
2. **Página de Compra** — preview vídeo, descrição, preço, prova social, garantia 7 dias
3. **Cadastro Progressivo** — formulário Nível 1 → Nível 2 com pagamento
4. **Player** — Deep Navy background, marca d'água, capítulos, cross-sell
5. **Dashboard do Criador** — métricas, gráfico, saque Stripe, tabela de klips, compradores

**Arquivo:** `klip-premium-wireframes.html` (101 KB, 3.427 linhas)

---

## 13. Escopo fora do MVP (inegociável)

Para evitar scope creep, estes itens **não entram no MVP**:

- ✗ Cupons de desconto
- ✗ Pacotes/bundles de klips
- ✗ Afiliados para klips individuais
- ✗ Live streaming pago (live ao vivo paga)
- ✗ Parcelamento no cartão
- ✗ Klips gratuitos como isca (todos têm preço > R$0)
- ✗ Cross-community klips (colaboração com split de receita)
- ✗ Camada social (Discover, seguir criador, perfil público)
- ✗ Mobile nativo (só web responsivo no MVP)

Todos podem voltar à mesa após validação das métricas dos primeiros 50 criadores.

---

## 14. Métricas obrigatórias do MVP

### 14.1 Por klip premium

- Visualizações da página de compra (leads)
- Compras efetivadas
- Taxa de conversão (compras / visualizações)
- Receita total / líquida ao criador
- % de conclusão médio
- Tempo médio de consumo

### 14.2 Por criador

- MRR via Klips Premium
- Ticket médio
- Clientes recorrentes (compraram > 1)
- Top 3 klips mais vendidos
- LTV médio por membro

---

## 15. Próximas etapas recomendadas

Ordem sugerida para execução:

### 15.1 Imediato (esta semana)

1. **Atualizar PRD no repositório** — substituir `klip-prd-v2.md` com a versão expandida (1.111 linhas)
2. **Implementar correções na tela "klip admin"** via Claude Code:
   - Remover sidebar de usuário (Feed, Klips salvos, Biblioteca Pessoal, Decisões, Busca IA)
   - Adicionar sidebar de admin (Dashboard, Usuários, Comunidades, Financeiro, Analytics, Convites, Suporte, Configurações)
   - Renomear "Álbuns Premium" para "Monetização" (engloba todos os tipos)
   - Separar URLs: `/admin` vs `/app`
3. **Ajustes na página de comunidade** via Claude Code:
   - Barra de ações: verbos explícitos ("Marcar decisão", "Iniciar live", "Gerar resumo")
   - Hierarquizar: primário "+ Novo tópico", secundários, terciário em menu `⋮`
   - Trocar ícones por lucide-react (MessageSquarePlus, CheckCircle2, Radio, Sparkles)
   - Diferenciar visualmente barra de ações vs barra de abas

### 15.2 Curto prazo (próximas 2 semanas)

4. **Documentar Álbuns formalmente no PRD** (seção 10.6) — feature que existe no código mas não está no PRD
5. **Implementar Área Premium** via Claude Code seguindo wireframes + seção 10.5:
   - Schema do banco (5 tabelas)
   - Stripe Connect + checkout
   - Integração Mux (upload, signed URLs, player)
   - Marca d'água dinâmica
   - Dashboard do criador
6. **Escrever copy da landing page** (`digitalklip.com`) usando posicionamento das seções 1.4 e 1.5

### 15.3 Médio prazo (próximo mês)

7. **Onboarding dos primeiros 10 Founding Creators** (invite-only)
8. **Medir conversão de convite → comprador** (Nível 1 → Nível 2)
9. **Analytics básico** (Mixpanel ou Plausible para funis)

---

## 16. Decisões cronológicas da sessão

Registro rápido pra consulta futura:

| # | Decisão |
|---|---|
| 1 | Posicionamento: criador monetiza respostas (não cursos) |
| 2 | Álbuns: manter como feature separada no MVP (já implementada) |
| 3 | Vídeo: Mux desde o dia 1 (DRM para evoluir) |
| 4 | Visão A confirmada: ferramenta fechada (sem rede social) |
| 5 | Invite-only para Founding Creators (50 primeiros) |
| 6 | Incentivos de convite entre criadores: comissão 20% vitalícia + status + cross-klip (Fase 3) |
| 7 | Área Premium como subitem da comunidade (Opção B) |
| 8 | Duas abas abandonadas → grid único |
| 9 | "Chat" como nome do subitem (não "Tópicos") |
| 10 | Sem Biblioteca Pessoal global no UI |
| 11 | Cadastro progressivo 2 níveis (email → dados completos) |
| 12 | Título personalizado: "Olá, [Nome]. Estes são os conteúdos premium do [Criador]." |
| 13 | Sidebar do membro simplificada (só comunidades + Configurações) |
| 14 | Dashboard do Criador como painel separado |

---

## 17. Arquivos produzidos nesta sessão

| Arquivo | Descrição | Status |
|---|---|---|
| `klip-prd-v2.md` | PRD completo atualizado (1.111 linhas) | ✓ Pronto pra substituir no repo |
| `klip-premium-wireframes.html` | 5 telas navegáveis (101 KB) | ✓ Aprovado visualmente |
| `klip-prd-secoes-1-4-e-1-5.md` | Seções isoladas (referência) | ✓ Backup |
| `KLIP-SESSAO-DECISOES-ABR-2026.md` | Este documento (consolidado da sessão) | ✓ Novo |

---

*Documento gerado em 18 de abril de 2026 · Klip · Confidencial · Uso interno*
