CREATE TABLE `users` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `emoji` text NOT NULL,
  `created_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakdown
CREATE TABLE `movies` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `tmdb_id` integer NOT NULL,
  `title` text NOT NULL,
  `overview` text,
  `poster_path` text,
  `backdrop_path` text,
  `release_date` text,
  `vote_average` integer,
  `provider_ids` text,
  `created_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakdown
CREATE UNIQUE INDEX `movies_tmdb_id_unique` ON `movies` (`tmdb_id`);
--> statement-breakdown
CREATE TABLE `swipes` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL,
  `movie_id` integer NOT NULL,
  `direction` text NOT NULL,
  `created_at` integer NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakdown
CREATE UNIQUE INDEX `unique_user_movie_swipe` ON `swipes` (`user_id`,`movie_id`);
