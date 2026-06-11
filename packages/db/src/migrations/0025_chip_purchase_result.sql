-- Tie tournament session rebuy/addon results to rule-defined Chip Purchases.
--
-- The result is no longer three free-form scalars on session_tournament_detail
-- (rebuy_count / rebuy_cost / addon_cost). Instead, each rule-defined chip
-- purchase (a session_chip_purchase row) gets a purchase count, and cost is
-- derived from session_chip_purchase.cost.
--
-- Dev DB only: the three legacy columns are dropped with no backfill.

-- ============================================================
-- session_chip_purchase_result: purchase count per chip purchase.
-- session_chip_purchase_id is PK=FK (one result row per purchase).
-- ============================================================

CREATE TABLE `session_chip_purchase_result` (
    `session_chip_purchase_id` text PRIMARY KEY NOT NULL,
    `count` integer DEFAULT 0 NOT NULL,
    FOREIGN KEY (`session_chip_purchase_id`) REFERENCES `session_chip_purchase`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- ============================================================
-- session_tournament_detail: drop the legacy scalar result columns.
-- ============================================================

ALTER TABLE `session_tournament_detail` DROP COLUMN `rebuy_count`;
--> statement-breakpoint
ALTER TABLE `session_tournament_detail` DROP COLUMN `rebuy_cost`;
--> statement-breakpoint
ALTER TABLE `session_tournament_detail` DROP COLUMN `addon_cost`;
