-- SA2-42: ドメイン概念「Store」を「Room」へリネーム（テーブル・カラム・インデックス）。
-- pure ALTER ... RENAME のみ。DROP TABLE を使わないためデータは保持される。
-- モダン SQLite はテーブル rename 時に ring_game / tournament / game_session の
-- FK 句（REFERENCES store(id)）を自動で room(id) に書き換え、RENAME COLUMN 時には
-- 各子テーブルのローカルカラム参照も書き換える。インデックスは「名前」が自動更新
-- されないため drop + 再作成する。

ALTER TABLE `store` RENAME TO `room`;--> statement-breakpoint
DROP INDEX `store_userId_idx`;--> statement-breakpoint
CREATE INDEX `room_userId_idx` ON `room` (`user_id`);--> statement-breakpoint
ALTER TABLE `ring_game` RENAME COLUMN `store_id` TO `room_id`;--> statement-breakpoint
DROP INDEX `ringGame_storeId_idx`;--> statement-breakpoint
CREATE INDEX `ringGame_roomId_idx` ON `ring_game` (`room_id`);--> statement-breakpoint
ALTER TABLE `tournament` RENAME COLUMN `store_id` TO `room_id`;--> statement-breakpoint
DROP INDEX `tournament_storeId_idx`;--> statement-breakpoint
CREATE INDEX `tournament_roomId_idx` ON `tournament` (`room_id`);--> statement-breakpoint
ALTER TABLE `game_session` RENAME COLUMN `store_id` TO `room_id`;--> statement-breakpoint
DROP INDEX `session_store_idx`;--> statement-breakpoint
CREATE INDEX `session_room_idx` ON `game_session` (`room_id`);
