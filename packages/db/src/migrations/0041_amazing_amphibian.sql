PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ring_game` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text,
	`user_id` text,
	`name` text NOT NULL,
	`variant` text DEFAULT 'NL Hold''em' NOT NULL,
	`mix_games` text,
	`blind1` integer,
	`blind2` integer,
	`blind3` integer,
	`ante` integer,
	`ante_type` text,
	`min_buy_in` integer,
	`max_buy_in` integer,
	`table_size` integer,
	`currency_id` text,
	`memo` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `room`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_ring_game`("id", "room_id", "user_id", "name", "variant", "mix_games", "blind1", "blind2", "blind3", "ante", "ante_type", "min_buy_in", "max_buy_in", "table_size", "currency_id", "memo", "archived_at", "created_at", "updated_at") SELECT "id", "room_id", "user_id", "name", "variant", "mix_games", "blind1", "blind2", "blind3", "ante", "ante_type", "min_buy_in", "max_buy_in", "table_size", "currency_id", "memo", "archived_at", "created_at", "updated_at" FROM `ring_game`;--> statement-breakpoint
DROP TABLE `ring_game`;--> statement-breakpoint
ALTER TABLE `__new_ring_game` RENAME TO `ring_game`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `ringGame_roomId_idx` ON `ring_game` (`room_id`);--> statement-breakpoint
CREATE INDEX `ringGame_userId_idx` ON `ring_game` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_session_cash_detail` (
	`session_id` text PRIMARY KEY NOT NULL,
	`ring_game_id` text,
	`buy_in` integer,
	`cash_out` integer,
	`ev_cash_out` integer,
	`rule_name` text DEFAULT 'Untitled' NOT NULL,
	`variant` text DEFAULT 'NL Hold''em' NOT NULL,
	`mix_games` text,
	`blind1` integer,
	`blind2` integer,
	`blind3` integer,
	`ante` integer,
	`ante_type` text,
	`min_buy_in` integer,
	`max_buy_in` integer,
	`table_size` integer,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ring_game_id`) REFERENCES `ring_game`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_session_cash_detail`("session_id", "ring_game_id", "buy_in", "cash_out", "ev_cash_out", "rule_name", "variant", "mix_games", "blind1", "blind2", "blind3", "ante", "ante_type", "min_buy_in", "max_buy_in", "table_size") SELECT "session_id", "ring_game_id", "buy_in", "cash_out", "ev_cash_out", "rule_name", "variant", "mix_games", "blind1", "blind2", "blind3", "ante", "ante_type", "min_buy_in", "max_buy_in", "table_size" FROM `session_cash_detail`;--> statement-breakpoint
DROP TABLE `session_cash_detail`;--> statement-breakpoint
ALTER TABLE `__new_session_cash_detail` RENAME TO `session_cash_detail`;--> statement-breakpoint
CREATE INDEX `session_cash_ring_idx` ON `session_cash_detail` (`ring_game_id`);--> statement-breakpoint
CREATE TABLE `__new_session_tournament_detail` (
	`session_id` text PRIMARY KEY NOT NULL,
	`tournament_id` text,
	`tournament_buy_in` integer,
	`entry_fee` integer,
	`placement` integer,
	`total_entries` integer,
	`before_deadline` integer,
	`prize_money` integer,
	`bounty_prizes` integer,
	`timer_started_at` integer,
	`rule_name` text DEFAULT 'Untitled' NOT NULL,
	`variant` text DEFAULT 'NL Hold''em' NOT NULL,
	`starting_stack` integer,
	`bounty_amount` integer,
	`table_size` integer,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournament`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_session_tournament_detail`("session_id", "tournament_id", "tournament_buy_in", "entry_fee", "placement", "total_entries", "before_deadline", "prize_money", "bounty_prizes", "timer_started_at", "rule_name", "variant", "starting_stack", "bounty_amount", "table_size") SELECT "session_id", "tournament_id", "tournament_buy_in", "entry_fee", "placement", "total_entries", "before_deadline", "prize_money", "bounty_prizes", "timer_started_at", "rule_name", "variant", "starting_stack", "bounty_amount", "table_size" FROM `session_tournament_detail`;--> statement-breakpoint
DROP TABLE `session_tournament_detail`;--> statement-breakpoint
ALTER TABLE `__new_session_tournament_detail` RENAME TO `session_tournament_detail`;--> statement-breakpoint
CREATE INDEX `session_tournament_tournament_idx` ON `session_tournament_detail` (`tournament_id`);--> statement-breakpoint
CREATE TABLE `__new_tournament` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`name` text NOT NULL,
	`variant` text DEFAULT 'NL Hold''em' NOT NULL,
	`buy_in` integer,
	`entry_fee` integer,
	`starting_stack` integer,
	`bounty_amount` integer,
	`table_size` integer,
	`currency_id` text,
	`memo` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `room`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_tournament`("id", "room_id", "name", "variant", "buy_in", "entry_fee", "starting_stack", "bounty_amount", "table_size", "currency_id", "memo", "archived_at", "created_at", "updated_at") SELECT "id", "room_id", "name", "variant", "buy_in", "entry_fee", "starting_stack", "bounty_amount", "table_size", "currency_id", "memo", "archived_at", "created_at", "updated_at" FROM `tournament`;--> statement-breakpoint
DROP TABLE `tournament`;--> statement-breakpoint
ALTER TABLE `__new_tournament` RENAME TO `tournament`;--> statement-breakpoint
CREATE INDEX `tournament_roomId_idx` ON `tournament` (`room_id`);--> statement-breakpoint
-- Dedup backstop (c08/c14): the pre-fix seed guard raced on a fully-empty
-- account, so a preview DB may already hold duplicate (user_id, builtin_key)
-- or (user_id, label) rows for game_group/game_variant/game_mix. Keep the
-- lowest-rowid row per key and drop the rest so the unique indexes below
-- cannot fail to create. Preview data loss from this dedup is acceptable
-- (duplicates only ever come from the concurrent-seed bug this PR fixes).
DELETE FROM `game_group` WHERE `rowid` NOT IN (
	SELECT MIN(`rowid`) FROM `game_group` GROUP BY `user_id`, `label`
);--> statement-breakpoint
DELETE FROM `game_group` WHERE `builtin_key` IS NOT NULL AND `rowid` NOT IN (
	SELECT MIN(`rowid`) FROM `game_group` WHERE `builtin_key` IS NOT NULL GROUP BY `user_id`, `builtin_key`
);--> statement-breakpoint
DELETE FROM `game_variant` WHERE `rowid` NOT IN (
	SELECT MIN(`rowid`) FROM `game_variant` GROUP BY `user_id`, `label`
);--> statement-breakpoint
DELETE FROM `game_variant` WHERE `builtin_key` IS NOT NULL AND `rowid` NOT IN (
	SELECT MIN(`rowid`) FROM `game_variant` WHERE `builtin_key` IS NOT NULL GROUP BY `user_id`, `builtin_key`
);--> statement-breakpoint
DELETE FROM `game_mix` WHERE `rowid` NOT IN (
	SELECT MIN(`rowid`) FROM `game_mix` GROUP BY `user_id`, `label`
);--> statement-breakpoint
DELETE FROM `game_mix` WHERE `builtin_key` IS NOT NULL AND `rowid` NOT IN (
	SELECT MIN(`rowid`) FROM `game_mix` WHERE `builtin_key` IS NOT NULL GROUP BY `user_id`, `builtin_key`
);--> statement-breakpoint
CREATE UNIQUE INDEX `gameGroup_userId_builtinKey_idx` ON `game_group` (`user_id`,`builtin_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `gameGroup_userId_label_idx` ON `game_group` (`user_id`,`label`);--> statement-breakpoint
CREATE UNIQUE INDEX `gameMix_userId_builtinKey_idx` ON `game_mix` (`user_id`,`builtin_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `gameMix_userId_label_idx` ON `game_mix` (`user_id`,`label`);--> statement-breakpoint
CREATE UNIQUE INDEX `gameVariant_userId_builtinKey_idx` ON `game_variant` (`user_id`,`builtin_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `gameVariant_userId_label_idx` ON `game_variant` (`user_id`,`label`);