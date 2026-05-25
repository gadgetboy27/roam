CREATE TABLE "admin_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" varchar NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"details" text,
	"ip" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "group_event_attendees" ADD COLUMN "ticket_paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "group_event_attendees" ADD COLUMN "ticket_session_id" text;--> statement-breakpoint
ALTER TABLE "group_events" ADD COLUMN "ticket_price_nzd" integer;--> statement-breakpoint
ALTER TABLE "group_messages" ADD COLUMN "is_announcement" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "boost_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_organiser" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_connect_account_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_connect_onboarded" boolean DEFAULT false;--> statement-breakpoint
CREATE INDEX "idx_audit_log_admin" ON "admin_audit_log" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_created" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ads_status" ON "ads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bucket_list_user" ON "bucket_list" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_event_attendees_event" ON "group_event_attendees" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_event_attendees_user" ON "group_event_attendees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_group_events_group" ON "group_events" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_group_members_group" ON "group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_group_members_user" ON "group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_group_messages_group" ON "group_messages" USING btree ("group_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_groups_leader" ON "groups" USING btree ("leader_id");--> statement-breakpoint
CREATE INDEX "idx_matches_user_a" ON "matches" USING btree ("user_a_id");--> statement-breakpoint
CREATE INDEX "idx_matches_user_b" ON "matches" USING btree ("user_b_id");--> statement-breakpoint
CREATE INDEX "idx_matches_status" ON "matches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_messages_match" ON "messages" USING btree ("match_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_user" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "idx_photos_user_id" ON "photos" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_users_stripe_customer" ON "users" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_boost_expires" ON "users" USING btree ("boost_expires_at");