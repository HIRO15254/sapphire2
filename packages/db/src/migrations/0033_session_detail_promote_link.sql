-- SA2-80: 複数Dayトーナメント対応 — session_tournament_detail に
-- Promote / 前Dayリンク / bag スタックのカラムを追加。
--   result            : 'promoted'（次Day進出）| 'finished'（着順・賞金で確定）
--   previous_session_id: 前Dayの promote 済みセッションへのリンク。
--                        unique index で「1つの promote は1回だけ消費」を保証。
--                        NULL = 新規参戦（Day2 マックスレイト含む）。
--   bag_stack         : promote 時の最終スタック → 次Day開始スタックへ引き継ぎ。
-- 全カラム nullable のため既存データ・単日トーナメントに影響なし。
ALTER TABLE `session_tournament_detail` ADD COLUMN `result` text;
--> statement-breakpoint
ALTER TABLE `session_tournament_detail` ADD COLUMN `previous_session_id` text REFERENCES `game_session`(`id`) ON DELETE set null;
--> statement-breakpoint
ALTER TABLE `session_tournament_detail` ADD COLUMN `bag_stack` integer;
--> statement-breakpoint
CREATE UNIQUE INDEX `session_tournament_previous_session_unique` ON `session_tournament_detail` (`previous_session_id`);
