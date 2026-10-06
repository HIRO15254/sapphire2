CREATE UNIQUE INDEX `currency_id_user_id_unique` ON `currency` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_id_user_id_unique` ON `player` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_tag_id_user_id_unique` ON `player_tag` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ring_game_id_user_id_unique` ON `ring_game` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `room_id_user_id_unique` ON `room` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_id_user_id_unique` ON `tournament` (`id`,`user_id`);--> statement-breakpoint
CREATE INDEX `tournament_userId_idx` ON `tournament` (`user_id`);