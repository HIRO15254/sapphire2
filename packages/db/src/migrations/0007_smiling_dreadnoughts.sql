CREATE TABLE `live_cash_game_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`store_id` text,
	`ring_game_id` text,
	`currency_id` text,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`store_id`) REFERENCES `store`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`ring_game_id`) REFERENCES `ring_game`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `liveCashGameSession_userId_idx` ON `live_cash_game_session` (`user_id`);--> statement-breakpoint
CREATE INDEX `liveCashGameSession_status_idx` ON `live_cash_game_session` (`status`);--> statement-breakpoint
CREATE INDEX `liveCashGameSession_storeId_idx` ON `live_cash_game_session` (`store_id`);--> statement-breakpoint
CREATE TABLE `live_tournament_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`store_id` text,
	`tournament_id` text,
	`currency_id` text,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`store_id`) REFERENCES `store`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournament`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `liveTournamentSession_userId_idx` ON `live_tournament_session` (`user_id`);--> statement-breakpoint
CREATE INDEX `liveTournamentSession_status_idx` ON `live_tournament_session` (`status`);--> statement-breakpoint
CREATE INDEX `liveTournamentSession_storeId_idx` ON `live_tournament_session` (`store_id`);--> statement-breakpoint
CREATE TABLE `session_event` (
	`id` text PRIMARY KEY NOT NULL,
	`live_cash_game_session_id` text,
	`live_tournament_session_id` text,
	`event_type` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`live_cash_game_session_id`) REFERENCES `live_cash_game_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`live_tournament_session_id`) REFERENCES `live_tournament_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessionEvent_liveCashGameSessionId_idx` ON `session_event` (`live_cash_game_session_id`);--> statement-breakpoint
CREATE INDEX `sessionEvent_liveTournamentSessionId_idx` ON `session_event` (`live_tournament_session_id`);--> statement-breakpoint
CREATE INDEX `sessionEvent_eventType_idx` ON `session_event` (`event_type`);--> statement-breakpoint
CREATE TABLE `session_table_player` (
	`id` text PRIMARY KEY NOT NULL,
	`live_cash_game_session_id` text,
	`live_tournament_session_id` text,
	`player_id` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`joined_at` integer NOT NULL,
	`left_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`live_cash_game_session_id`) REFERENCES `live_cash_game_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`live_tournament_session_id`) REFERENCES `live_tournament_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessionTablePlayer_liveCashGameSessionId_idx` ON `session_table_player` (`live_cash_game_session_id`);--> statement-breakpoint
CREATE INDEX `sessionTablePlayer_liveTournamentSessionId_idx` ON `session_table_player` (`live_tournament_session_id`);--> statement-breakpoint
CREATE INDEX `sessionTablePlayer_playerId_idx` ON `session_table_player` (`player_id`);--> statement-breakpoint
ALTER TABLE `poker_session` ADD `live_cash_game_session_id` text REFERENCES live_cash_game_session(id);--> statement-breakpoint
ALTER TABLE `poker_session` ADD `live_tournament_session_id` text REFERENCES live_tournament_session(id);