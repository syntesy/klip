CREATE TYPE "public"."member_role" AS ENUM('owner', 'moderator', 'member');--> statement-breakpoint
CREATE TYPE "public"."topic_status" AS ENUM('active', 'resolved', 'closed');--> statement-breakpoint
CREATE TABLE "communities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"owner_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"created_by" varchar(255) NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"status" "topic_status" DEFAULT 'active' NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"author_id" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"is_edited" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "klips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"message_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"content" text NOT NULL,
	"requested_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "klips" ADD CONSTRAINT "klips_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_summaries" ADD CONSTRAINT "ai_summaries_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "communities_slug_unique" ON "communities" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "communities_owner_id_idx" ON "communities" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "community_members_unique" ON "community_members" USING btree ("community_id","user_id");--> statement-breakpoint
CREATE INDEX "community_members_user_id_idx" ON "community_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "topics_community_status_activity_idx" ON "topics" USING btree ("community_id","status","last_activity_at");--> statement-breakpoint
CREATE INDEX "messages_topic_created_idx" ON "messages" USING btree ("topic_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_author_id_idx" ON "messages" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "klips_user_message_unique" ON "klips" USING btree ("user_id","message_id");--> statement-breakpoint
CREATE INDEX "klips_user_id_idx" ON "klips" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_summaries_topic_id_idx" ON "ai_summaries" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "ai_summaries_created_at_idx" ON "ai_summaries" USING btree ("created_at");