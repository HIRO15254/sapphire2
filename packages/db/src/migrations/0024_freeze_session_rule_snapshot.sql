-- Freeze ring_game / tournament rule data onto session detail rows.
-- Going forward, parent rename / blind change does not propagate to past
-- sessions because session_cash_detail / session_tournament_detail keep
-- their own snapshot of name, variant, blinds, etc.
--
-- Strategy:
--   1. Add nullable snapshot columns first (blinds, table size, etc.) so we
--      can backfill them from the parent before we use them.
--   2. Backfill the nullable columns from ring_game / tournament where the
--      parent reference is non-null.
--   3. Add the NOT NULL snapshot columns with a placeholder default so
--      SQLite accepts ALTER TABLE ADD COLUMN on existing rows.
--   4. Overwrite the NOT NULL columns from the parent where present;
--      derive a sensible name from the freshly-backfilled blinds when the
--      parent reference is null.

-- ============================================================
-- session_cash_detail: nullable snapshot columns
-- ============================================================

ALTER TABLE `session_cash_detail` ADD COLUMN `blind1` integer;
--> statement-breakpoint
ALTER TABLE `session_cash_detail` ADD COLUMN `blind2` integer;
--> statement-breakpoint
ALTER TABLE `session_cash_detail` ADD COLUMN `blind3` integer;
--> statement-breakpoint
ALTER TABLE `session_cash_detail` ADD COLUMN `ante` integer;
--> statement-breakpoint
ALTER TABLE `session_cash_detail` ADD COLUMN `ante_type` text;
--> statement-breakpoint
ALTER TABLE `session_cash_detail` ADD COLUMN `min_buy_in` integer;
--> statement-breakpoint
ALTER TABLE `session_cash_detail` ADD COLUMN `max_buy_in` integer;
--> statement-breakpoint
ALTER TABLE `session_cash_detail` ADD COLUMN `table_size` integer;
--> statement-breakpoint

UPDATE `session_cash_detail`
SET
    `blind1` = (SELECT `blind1` FROM `ring_game` WHERE `ring_game`.`id` = `session_cash_detail`.`ring_game_id`),
    `blind2` = (SELECT `blind2` FROM `ring_game` WHERE `ring_game`.`id` = `session_cash_detail`.`ring_game_id`),
    `blind3` = (SELECT `blind3` FROM `ring_game` WHERE `ring_game`.`id` = `session_cash_detail`.`ring_game_id`),
    `ante` = (SELECT `ante` FROM `ring_game` WHERE `ring_game`.`id` = `session_cash_detail`.`ring_game_id`),
    `ante_type` = (SELECT `ante_type` FROM `ring_game` WHERE `ring_game`.`id` = `session_cash_detail`.`ring_game_id`),
    `min_buy_in` = (SELECT `min_buy_in` FROM `ring_game` WHERE `ring_game`.`id` = `session_cash_detail`.`ring_game_id`),
    `max_buy_in` = (SELECT `max_buy_in` FROM `ring_game` WHERE `ring_game`.`id` = `session_cash_detail`.`ring_game_id`),
    `table_size` = (SELECT `table_size` FROM `ring_game` WHERE `ring_game`.`id` = `session_cash_detail`.`ring_game_id`)
WHERE `ring_game_id` IS NOT NULL;
--> statement-breakpoint

-- ============================================================
-- session_cash_detail: NOT NULL snapshot columns
-- ============================================================

ALTER TABLE `session_cash_detail` ADD COLUMN `rule_name` text NOT NULL DEFAULT 'Untitled';
--> statement-breakpoint
ALTER TABLE `session_cash_detail` ADD COLUMN `variant` text NOT NULL DEFAULT 'nlh';
--> statement-breakpoint

UPDATE `session_cash_detail`
SET
    `rule_name` = COALESCE(
        (SELECT `name` FROM `ring_game` WHERE `ring_game`.`id` = `session_cash_detail`.`ring_game_id`),
        CASE
            WHEN `session_cash_detail`.`blind1` IS NOT NULL
              AND `session_cash_detail`.`blind2` IS NOT NULL
                THEN 'NLH ' || `session_cash_detail`.`blind1` || '/' || `session_cash_detail`.`blind2`
            ELSE 'Untitled'
        END
    ),
    `variant` = COALESCE(
        (SELECT `variant` FROM `ring_game` WHERE `ring_game`.`id` = `session_cash_detail`.`ring_game_id`),
        'nlh'
    );
--> statement-breakpoint

-- ============================================================
-- session_tournament_detail: nullable snapshot columns
-- ============================================================

ALTER TABLE `session_tournament_detail` ADD COLUMN `starting_stack` integer;
--> statement-breakpoint
ALTER TABLE `session_tournament_detail` ADD COLUMN `bounty_amount` integer;
--> statement-breakpoint
ALTER TABLE `session_tournament_detail` ADD COLUMN `table_size` integer;
--> statement-breakpoint

UPDATE `session_tournament_detail`
SET
    `starting_stack` = (SELECT `starting_stack` FROM `tournament` WHERE `tournament`.`id` = `session_tournament_detail`.`tournament_id`),
    `bounty_amount` = (SELECT `bounty_amount` FROM `tournament` WHERE `tournament`.`id` = `session_tournament_detail`.`tournament_id`),
    `table_size` = (SELECT `table_size` FROM `tournament` WHERE `tournament`.`id` = `session_tournament_detail`.`tournament_id`)
WHERE `tournament_id` IS NOT NULL;
--> statement-breakpoint

-- Backfill the existing tournament_buy_in / entry_fee columns from the
-- parent for any sessions that never recorded their own values. After this
-- migration, those detail-level columns are also treated as snapshots.

UPDATE `session_tournament_detail`
SET `tournament_buy_in` = (SELECT `buy_in` FROM `tournament` WHERE `tournament`.`id` = `session_tournament_detail`.`tournament_id`)
WHERE `tournament_id` IS NOT NULL
  AND `tournament_buy_in` IS NULL;
--> statement-breakpoint

UPDATE `session_tournament_detail`
SET `entry_fee` = (SELECT `entry_fee` FROM `tournament` WHERE `tournament`.`id` = `session_tournament_detail`.`tournament_id`)
WHERE `tournament_id` IS NOT NULL
  AND `entry_fee` IS NULL;
--> statement-breakpoint

-- ============================================================
-- session_tournament_detail: NOT NULL snapshot columns
-- ============================================================

ALTER TABLE `session_tournament_detail` ADD COLUMN `rule_name` text NOT NULL DEFAULT 'Untitled';
--> statement-breakpoint
ALTER TABLE `session_tournament_detail` ADD COLUMN `variant` text NOT NULL DEFAULT 'nlh';
--> statement-breakpoint

UPDATE `session_tournament_detail`
SET
    `rule_name` = COALESCE(
        (SELECT `name` FROM `tournament` WHERE `tournament`.`id` = `session_tournament_detail`.`tournament_id`),
        'Untitled'
    ),
    `variant` = COALESCE(
        (SELECT `variant` FROM `tournament` WHERE `tournament`.`id` = `session_tournament_detail`.`tournament_id`),
        'nlh'
    );
--> statement-breakpoint

-- ============================================================
-- session_blind_level / session_chip_purchase: snapshot of the
-- tournament's blind progression and chip purchase options.
-- Parent edits to blind_level / tournament_chip_purchase no longer
-- propagate to past sessions.
-- ============================================================

CREATE TABLE `session_blind_level` (
    `id` text PRIMARY KEY NOT NULL,
    `session_id` text NOT NULL,
    `level` integer NOT NULL,
    `is_break` integer DEFAULT 0 NOT NULL,
    `blind1` integer,
    `blind2` integer,
    `blind3` integer,
    `ante` integer,
    `minutes` integer,
    FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE INDEX `session_blind_level_session_idx` ON `session_blind_level` (`session_id`);
--> statement-breakpoint

CREATE TABLE `session_chip_purchase` (
    `id` text PRIMARY KEY NOT NULL,
    `session_id` text NOT NULL,
    `name` text NOT NULL,
    `cost` integer NOT NULL,
    `chips` integer NOT NULL,
    `sort_order` integer DEFAULT 0 NOT NULL,
    FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE INDEX `session_chip_purchase_session_idx` ON `session_chip_purchase` (`session_id`);
--> statement-breakpoint

-- Backfill: for each existing session_tournament_detail row linked to a
-- tournament, copy every parent blind_level / tournament_chip_purchase
-- row across using a fresh hex id. The cross-join INSERT runs the source
-- query once per (session, level) or (session, purchase) pair.

INSERT INTO `session_blind_level` (`id`, `session_id`, `level`, `is_break`, `blind1`, `blind2`, `blind3`, `ante`, `minutes`)
SELECT
    lower(hex(randomblob(16))),
    std.`session_id`,
    bl.`level`,
    bl.`is_break`,
    bl.`blind1`,
    bl.`blind2`,
    bl.`blind3`,
    bl.`ante`,
    bl.`minutes`
FROM `session_tournament_detail` std
JOIN `blind_level` bl ON bl.`tournament_id` = std.`tournament_id`;
--> statement-breakpoint

INSERT INTO `session_chip_purchase` (`id`, `session_id`, `name`, `cost`, `chips`, `sort_order`)
SELECT
    lower(hex(randomblob(16))),
    std.`session_id`,
    tcp.`name`,
    tcp.`cost`,
    tcp.`chips`,
    tcp.`sort_order`
FROM `session_tournament_detail` std
JOIN `tournament_chip_purchase` tcp ON tcp.`tournament_id` = std.`tournament_id`;
