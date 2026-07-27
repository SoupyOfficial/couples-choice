CREATE TABLE `interest_signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`movie_id` integer NOT NULL,
	`dimension` text NOT NULL,
	`dimension_value` text NOT NULL,
	`signal` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_interest_signals_user_dim_value` ON `interest_signals` (`user_id`,`dimension`,`dimension_value`);--> statement-breakpoint
CREATE INDEX `idx_interest_signals_user_created` ON `interest_signals` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `llm_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cache_key` text NOT NULL,
	`response` text NOT NULL,
	`ttl_seconds` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `llm_cache_cache_key_unique` ON `llm_cache` (`cache_key`);--> statement-breakpoint
ALTER TABLE `movies` ADD `genre_ids` text;--> statement-breakpoint
ALTER TABLE `movies` ADD `popularity` real;--> statement-breakpoint
ALTER TABLE `movies` ADD `vote_count` integer;--> statement-breakpoint
ALTER TABLE `movies` ADD `llm_tags` text;--> statement-breakpoint
ALTER TABLE `movies` ADD `llm_enriched_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `preference_narrative` text;--> statement-breakpoint
ALTER TABLE `users` ADD `extracted_prefs` text;--> statement-breakpoint
ALTER TABLE `users` ADD `prefs_extracted_at` integer;