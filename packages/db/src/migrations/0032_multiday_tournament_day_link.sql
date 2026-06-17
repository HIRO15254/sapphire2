-- SA2-79: 複数Dayトーナメント対応 — tournament にDay連結カラムを追加。
-- 各Day＝1トーナメントルールのまま、前後Dayの有無フラグと、任意の
-- 次Dayルールへの自己参照を持たせる。全カラム default / nullable のため
-- 既存データ・単日トーナメントは無改修で現状維持。
ALTER TABLE `tournament` ADD COLUMN `has_next_day` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `tournament` ADD COLUMN `has_previous_day` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `tournament` ADD COLUMN `next_day_tournament_id` text REFERENCES `tournament`(`id`) ON DELETE set null;
