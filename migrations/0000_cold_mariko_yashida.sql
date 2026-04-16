CREATE TYPE "public"."ad_status" AS ENUM('pending_payment', 'pending_review', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('pending', 'liked_a', 'liked_b', 'matched', 'passed');--> statement-breakpoint
CREATE TYPE "public"."photo_verdict" AS ENUM('approved', 'needs_person', 'rejected_quote', 'rejected_manipulated', 'rejected_stock');--> statement-breakpoint
CREATE TYPE "public"."tier" AS ENUM('free', 'adventurer', 'contributor');--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text,
	"created_at" timestamp DEFAULT now(),
	"created_by" varchar,
	CONSTRAINT "admin_users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "ads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"advertiser_name" text NOT NULL,
	"advertiser_email" text NOT NULL,
	"advertiser_company" text,
	"tier" text NOT NULL,
	"headline" text NOT NULL,
	"tagline" text,
	"cta_text" text,
	"cta_url" text,
	"image_url" text,
	"video_url" text,
	"content_type" text DEFAULT 'image' NOT NULL,
	"status" "ad_status" DEFAULT 'pending_payment' NOT NULL,
	"stripe_session_id" text,
	"rejection_reason" text,
	"reviewed_at" timestamp,
	"expires_at" timestamp,
	"impressions" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"ad_type" text DEFAULT 'standard' NOT NULL,
	"submitted_by_user_id" varchar,
	"linked_group_id" varchar,
	"linked_event_id" varchar,
	"event_start_at" timestamp,
	"event_location" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bucket_list" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"destination_name" text NOT NULL,
	"image_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "group_event_attendees" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "group_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location" text,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "group_invites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"invited_email" text NOT NULL,
	"invited_by_user_id" varchar NOT NULL,
	"token" varchar NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"message" text,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "group_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp DEFAULT now(),
	"joined_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "group_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'squad' NOT NULL,
	"max_size" integer DEFAULT 5 NOT NULL,
	"leader_id" varchar NOT NULL,
	"location" text,
	"adventure_tags" text[],
	"cover_image_url" text,
	"visibility" text DEFAULT 'open' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_a_id" varchar NOT NULL,
	"user_b_id" varchar NOT NULL,
	"overlap_score" real DEFAULT 0,
	"shared_tags" text[],
	"status" "match_status" DEFAULT 'pending',
	"almost_met_location" text,
	"almost_met_date" text,
	"created_at" timestamp DEFAULT now(),
	"matched_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"data" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"storage_url" text NOT NULL,
	"caption" text,
	"person_score" integer DEFAULT 0,
	"authenticity_score" integer DEFAULT 100,
	"adventure_score" integer DEFAULT 0,
	"verdict" "photo_verdict" DEFAULT 'approved',
	"tags" text[],
	"manipulation_flags" text[],
	"is_licensable" boolean DEFAULT false,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"dob" text,
	"gender" text,
	"ethnicity" text,
	"location" text,
	"tagline" text,
	"tier" "tier" DEFAULT 'free' NOT NULL,
	"photo_license_agreed" boolean DEFAULT false,
	"adventure_tags" text[],
	"avatar_url" text,
	"identity_verified" boolean DEFAULT false,
	"identity_verification_id" text,
	"identity_verified_at" timestamp,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"open_to_roaming" boolean DEFAULT false,
	"is_founding_member" boolean DEFAULT false,
	"is_tier_gifted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
