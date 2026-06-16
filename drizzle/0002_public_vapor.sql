CREATE TABLE "corsair_embeddings" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"embedding" vector(768) NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "corsair_accounts" ADD COLUMN "email_address" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "priority_instructions" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "model_mode" text DEFAULT 'careful' NOT NULL;--> statement-breakpoint
ALTER TABLE "corsair_embeddings" ADD CONSTRAINT "corsair_embeddings_entity_id_corsair_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."corsair_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "embedding_cosine_idx" ON "corsair_embeddings" USING hnsw ("embedding" vector_cosine_ops);