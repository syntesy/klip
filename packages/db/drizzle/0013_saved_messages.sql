-- 0013: Biblioteca Pessoal — saved_messages (salvar mensagem manualmente, plano Pro+)

CREATE TABLE "saved_messages" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clerk_user_id"  varchar(255) NOT NULL,
  "message_id"     uuid NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "saved_at"       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "saved_messages_user_message_unique"
  ON "saved_messages" ("clerk_user_id", "message_id");
CREATE INDEX "saved_messages_user_idx"     ON "saved_messages" ("clerk_user_id");
CREATE INDEX "saved_messages_message_idx"  ON "saved_messages" ("message_id");
