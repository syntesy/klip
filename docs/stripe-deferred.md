# Stripe — Trabalho Adiado (2026-05-12)

## Status

A integração Stripe Connect + Checkout para Klips Premium foi adiada.

## Onde está o código

Branch: `feat/stripe-checkout` (commit `67f399d`)

Trabalho completo, sem testes, sem env vars configuradas no Railway.

## Quando retomar

Quando a decisão estratégica sobre monetização estiver consolidada e:
- `STRIPE_SECRET_KEY` configurada no Railway (test mode primeiro)
- `STRIPE_WEBHOOK_SECRET` configurada
- Endpoint do webhook registrado no dashboard Stripe

## Como retomar

```bash
git checkout feat/stripe-checkout
git rebase main
# resolver conflitos se houver
git checkout main
git merge feat/stripe-checkout
```

## Decisões pendentes antes do merge

- Albums vs Klips Premium (unificar fluxo de monetização)
- Confirmar comissões: Starter 8% / Pro 5% / Business 2%
- Validar cálculo de fees no `lib/stripe.ts` (cents, R$0,40 + 3,99%)
