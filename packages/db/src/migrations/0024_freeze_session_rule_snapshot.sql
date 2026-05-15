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
