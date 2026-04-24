-- CTI Session Refactor Migration
-- Replaces poker_session / live_cash_game_session / live_tournament_session
-- with a single game_session parent table and two detail child tables.
--
-- Strategy:
-- 1. Create new tables (game_session, session_cash_detail, session_tournament_detail)
-- 2. Backfill from poker_session (completed records, source=manual or live)
-- 3. Backfill live sessions not yet linked to poker_session (active/paused)
-- 4. Recreate session_event and session_table_player with unified session_id FK
-- 5. Migrate session_to_session_tag and currency_transaction FK
-- 6. Drop old tables

-- ============================================================
-- STEP 1: Create new tables
-- ============================================================

CREATE TABLE `game_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`session_date` integer NOT NULL,
	`started_at` integer,
	`ended_at` integer,
	`break_minutes` integer,
	`memo` text,
	`store_id` text,
	`currency_id` text,
	`hero_seat_position` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`store_id`) REFERENCES `store`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE set null,
	CHECK ((source != 'manual') OR (status = 'completed'))
);
--> statement-breakpoint

CREATE INDEX `session_user_kind_status_idx` ON `game_session` (`user_id`, `kind`, `status`);
--> statement-breakpoint

CREATE INDEX `session_user_date_idx` ON `game_session` (`user_id`, `session_date`);
--> statement-breakpoint

CREATE INDEX `session_store_idx` ON `game_session` (`store_id`);
--> statement-breakpoint

CREATE INDEX `session_currency_idx` ON `game_session` (`currency_id`);
--> statement-breakpoint

CREATE TABLE `session_cash_detail` (
	`session_id` text PRIMARY KEY NOT NULL,
	`ring_game_id` text,
	`buy_in` integer,
	`cash_out` integer,
	`ev_cash_out` integer,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ring_game_id`) REFERENCES `ring_game`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

CREATE INDEX `session_cash_ring_idx` ON `session_cash_detail` (`ring_game_id`);
--> statement-breakpoint

CREATE TABLE `session_tournament_detail` (
	`session_id` text PRIMARY KEY NOT NULL,
	`tournament_id` text,
	`tournament_buy_in` integer,
	`entry_fee` integer,
	`placement` integer,
	`total_entries` integer,
	`before_deadline` integer,
	`prize_money` integer,
	`rebuy_count` integer,
	`rebuy_cost` integer,
	`addon_cost` integer,
	`bounty_prizes` integer,
	`timer_started_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournament`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

CREATE INDEX `session_tournament_tournament_idx` ON `session_tournament_detail` (`tournament_id`);
--> statement-breakpoint

-- ============================================================
-- STEP 2: Backfill poker_session → game_session + detail tables
-- (These are completed records; source determined by live session FK)
-- ============================================================

INSERT INTO `game_session` (
	`id`,
	`user_id`,
	`kind`,
	`status`,
	`source`,
	`session_date`,
	`started_at`,
	`ended_at`,
	`break_minutes`,
	`memo`,
	`store_id`,
	`currency_id`,
	`hero_seat_position`,
	`created_at`,
	`updated_at`
)
SELECT
	ps.id,
	ps.user_id,
	ps.type,
	'completed',
	CASE
		WHEN ps.live_cash_game_session_id IS NOT NULL
		  OR ps.live_tournament_session_id IS NOT NULL
		THEN 'live'
		ELSE 'manual'
	END,
	ps.session_date,
	COALESCE(
		lcs.started_at,
		lts.started_at,
		ps.started_at
	),
	COALESCE(
		lcs.ended_at,
		lts.ended_at,
		ps.ended_at
	),
	ps.break_minutes,
	COALESCE(ps.memo, lcs.memo, lts.memo),
	ps.store_id,
	ps.currency_id,
	COALESCE(
		lcs.hero_seat_position,
		lts.hero_seat_position
	),
	ps.created_at,
	ps.updated_at
FROM poker_session ps
LEFT JOIN live_cash_game_session lcs ON lcs.id = ps.live_cash_game_session_id
LEFT JOIN live_tournament_session lts ON lts.id = ps.live_tournament_session_id;
--> statement-breakpoint

-- Insert cash details for cash_game type poker_sessions
INSERT INTO `session_cash_detail` (
	`session_id`,
	`ring_game_id`,
	`buy_in`,
	`cash_out`,
	`ev_cash_out`
)
SELECT
	ps.id,
	COALESCE(lcs.ring_game_id, ps.ring_game_id),
	ps.buy_in,
	ps.cash_out,
	ps.ev_cash_out
FROM poker_session ps
LEFT JOIN live_cash_game_session lcs ON lcs.id = ps.live_cash_game_session_id
WHERE ps.type = 'cash_game';
--> statement-breakpoint

-- Insert tournament details for tournament type poker_sessions
INSERT INTO `session_tournament_detail` (
	`session_id`,
	`tournament_id`,
	`tournament_buy_in`,
	`entry_fee`,
	`placement`,
	`total_entries`,
	`before_deadline`,
	`prize_money`,
	`rebuy_count`,
	`rebuy_cost`,
	`addon_cost`,
	`bounty_prizes`,
	`timer_started_at`
)
SELECT
	ps.id,
	COALESCE(lts.tournament_id, ps.tournament_id),
	ps.tournament_buy_in,
	COALESCE(lts.entry_fee, ps.entry_fee),
	ps.placement,
	ps.total_entries,
	ps.before_deadline,
	ps.prize_money,
	ps.rebuy_count,
	ps.rebuy_cost,
	ps.addon_cost,
	ps.bounty_prizes,
	lts.timer_started_at
FROM poker_session ps
LEFT JOIN live_tournament_session lts ON lts.id = ps.live_tournament_session_id
WHERE ps.type = 'tournament';
--> statement-breakpoint

-- ============================================================
-- STEP 3: Backfill live sessions NOT linked to poker_session
-- (active/paused sessions that were never "completed" into poker_session)
-- ============================================================

-- Live cash game sessions not linked to any poker_session
INSERT INTO `game_session` (
	`id`,
	`user_id`,
	`kind`,
	`status`,
	`source`,
	`session_date`,
	`started_at`,
	`ended_at`,
	`break_minutes`,
	`memo`,
	`store_id`,
	`currency_id`,
	`hero_seat_position`,
	`created_at`,
	`updated_at`
)
SELECT
	lcs.id,
	lcs.user_id,
	'cash_game',
	lcs.status,
	'live',
	lcs.started_at,
	lcs.started_at,
	lcs.ended_at,
	NULL,
	lcs.memo,
	lcs.store_id,
	lcs.currency_id,
	lcs.hero_seat_position,
	lcs.created_at,
	lcs.updated_at
FROM live_cash_game_session lcs
WHERE NOT EXISTS (
	SELECT 1 FROM poker_session ps
	WHERE ps.live_cash_game_session_id = lcs.id
);
--> statement-breakpoint

INSERT INTO `session_cash_detail` (
	`session_id`,
	`ring_game_id`,
	`buy_in`,
	`cash_out`,
	`ev_cash_out`
)
SELECT
	lcs.id,
	lcs.ring_game_id,
	NULL,
	NULL,
	NULL
FROM live_cash_game_session lcs
WHERE NOT EXISTS (
	SELECT 1 FROM poker_session ps
	WHERE ps.live_cash_game_session_id = lcs.id
);
--> statement-breakpoint

-- Live tournament sessions not linked to any poker_session
INSERT INTO `game_session` (
	`id`,
	`user_id`,
	`kind`,
	`status`,
	`source`,
	`session_date`,
	`started_at`,
	`ended_at`,
	`break_minutes`,
	`memo`,
	`store_id`,
	`currency_id`,
	`hero_seat_position`,
	`created_at`,
	`updated_at`
)
SELECT
	lts.id,
	lts.user_id,
	'tournament',
	lts.status,
	'live',
	lts.started_at,
	lts.started_at,
	lts.ended_at,
	NULL,
	lts.memo,
	lts.store_id,
	lts.currency_id,
	lts.hero_seat_position,
	lts.created_at,
	lts.updated_at
FROM live_tournament_session lts
WHERE NOT EXISTS (
	SELECT 1 FROM poker_session ps
	WHERE ps.live_tournament_session_id = lts.id
);
--> statement-breakpoint

INSERT INTO `session_tournament_detail` (
	`session_id`,
	`tournament_id`,
	`tournament_buy_in`,
	`entry_fee`,
	`placement`,
	`total_entries`,
	`before_deadline`,
	`prize_money`,
	`rebuy_count`,
	`rebuy_cost`,
	`addon_cost`,
	`bounty_prizes`,
	`timer_started_at`
)
SELECT
	lts.id,
	lts.tournament_id,
	lts.buy_in,
	lts.entry_fee,
	NULL,
	NULL,
	NULL,
	NULL,
	NULL,
	NULL,
	NULL,
	NULL,
	lts.timer_started_at
FROM live_tournament_session lts
WHERE NOT EXISTS (
	SELECT 1 FROM poker_session ps
	WHERE ps.live_tournament_session_id = lts.id
);
--> statement-breakpoint

-- ============================================================
-- STEP 4: Recreate session_event with unified session_id FK
-- ============================================================

CREATE TABLE `session_event_new` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`event_type` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

INSERT INTO `session_event_new` (
	`id`,
	`session_id`,
	`event_type`,
	`occurred_at`,
	`sort_order`,
	`payload`,
	`created_at`,
	`updated_at`
)
SELECT
	se.id,
	COALESCE(se.live_cash_game_session_id, se.live_tournament_session_id),
	se.event_type,
	se.occurred_at,
	se.sort_order,
	se.payload,
	se.created_at,
	se.updated_at
FROM session_event se
WHERE se.live_cash_game_session_id IS NOT NULL
   OR se.live_tournament_session_id IS NOT NULL;
--> statement-breakpoint

DROP TABLE `session_event`;
--> statement-breakpoint

ALTER TABLE `session_event_new` RENAME TO `session_event`;
--> statement-breakpoint

CREATE INDEX `sessionEvent_sessionId_idx` ON `session_event` (`session_id`);
--> statement-breakpoint

CREATE INDEX `sessionEvent_eventType_idx` ON `session_event` (`event_type`);
--> statement-breakpoint

-- ============================================================
-- STEP 5: Recreate session_table_player with unified session_id FK
-- ============================================================

CREATE TABLE `session_table_player_new` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`player_id` text NOT NULL,
	`seat_position` integer,
	`is_active` integer DEFAULT 1 NOT NULL,
	`joined_at` integer NOT NULL,
	`left_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

INSERT INTO `session_table_player_new` (
	`id`,
	`session_id`,
	`player_id`,
	`seat_position`,
	`is_active`,
	`joined_at`,
	`left_at`,
	`created_at`,
	`updated_at`
)
SELECT
	stp.id,
	COALESCE(stp.live_cash_game_session_id, stp.live_tournament_session_id),
	stp.player_id,
	stp.seat_position,
	stp.is_active,
	stp.joined_at,
	stp.left_at,
	stp.created_at,
	stp.updated_at
FROM session_table_player stp
WHERE stp.live_cash_game_session_id IS NOT NULL
   OR stp.live_tournament_session_id IS NOT NULL;
--> statement-breakpoint

DROP TABLE `session_table_player`;
--> statement-breakpoint

ALTER TABLE `session_table_player_new` RENAME TO `session_table_player`;
--> statement-breakpoint

CREATE INDEX `sessionTablePlayer_sessionId_idx` ON `session_table_player` (`session_id`);
--> statement-breakpoint

CREATE INDEX `sessionTablePlayer_playerId_idx` ON `session_table_player` (`player_id`);
--> statement-breakpoint

-- ============================================================
-- STEP 6: Recreate session_to_session_tag with FK pointing to game_session
-- (session_id values are from poker_session.id which are now in game_session.id)
-- ============================================================

CREATE TABLE `session_to_session_tag_new` (
	`session_id` text NOT NULL,
	`session_tag_id` text NOT NULL,
	PRIMARY KEY (`session_id`, `session_tag_id`),
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_tag_id`) REFERENCES `session_tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

INSERT INTO `session_to_session_tag_new` (`session_id`, `session_tag_id`)
SELECT `session_id`, `session_tag_id`
FROM `session_to_session_tag`;
--> statement-breakpoint

DROP TABLE `session_to_session_tag`;
--> statement-breakpoint

ALTER TABLE `session_to_session_tag_new` RENAME TO `session_to_session_tag`;
--> statement-breakpoint

-- ============================================================
-- STEP 7: Recreate currency_transaction with FK pointing to game_session
-- ============================================================

CREATE TABLE `currency_transaction_new` (
	`id` text PRIMARY KEY NOT NULL,
	`currency_id` text NOT NULL,
	`transaction_type_id` text NOT NULL,
	`session_id` text,
	`amount` integer NOT NULL,
	`transacted_at` integer NOT NULL,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_type_id`) REFERENCES `transaction_type`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

INSERT INTO `currency_transaction_new` (
	`id`,
	`currency_id`,
	`transaction_type_id`,
	`session_id`,
	`amount`,
	`transacted_at`,
	`memo`,
	`created_at`
)
SELECT
	`id`,
	`currency_id`,
	`transaction_type_id`,
	`session_id`,
	`amount`,
	`transacted_at`,
	`memo`,
	`created_at`
FROM `currency_transaction`;
--> statement-breakpoint

DROP TABLE `currency_transaction`;
--> statement-breakpoint

ALTER TABLE `currency_transaction_new` RENAME TO `currency_transaction`;
--> statement-breakpoint

CREATE INDEX `currencyTransaction_currencyId_idx` ON `currency_transaction` (`currency_id`);
--> statement-breakpoint

CREATE INDEX `currencyTransaction_sessionId_idx` ON `currency_transaction` (`session_id`);
--> statement-breakpoint

-- ============================================================
-- STEP 8: Drop old tables
-- ============================================================

DROP TABLE `poker_session`;
--> statement-breakpoint

DROP TABLE `live_cash_game_session`;
--> statement-breakpoint

DROP TABLE `live_tournament_session`;
