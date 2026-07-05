-- SA2-181: ring_game に本来の所有者 user_id を追加する（構造的 IDOR 修正）。
-- これまで所有権は room_id -> room.user_id で導出していたが、自動生成された
-- キャッシュルール行は room_id が NULL のため所有権の起点が無く、null-roomId 行が
-- 誰のものでもない状態になっていた。NULL 許容で追加し、既存行はバックフィルする。
ALTER TABLE `ring_game` ADD `user_id` text REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade;--> statement-breakpoint
-- room に紐づく行: room.user_id から所有者を復元する。
UPDATE `ring_game` SET `user_id` = (SELECT `user_id` FROM `room` WHERE `room`.`id` = `ring_game`.`room_id`) WHERE `room_id` IS NOT NULL;--> statement-breakpoint
-- 自動生成（room_id が NULL）の行: 所有セッション経由で所有者を復元する。
UPDATE `ring_game` SET `user_id` = (SELECT `gs`.`user_id` FROM `session_cash_detail` `scd` JOIN `game_session` `gs` ON `gs`.`id` = `scd`.`session_id` WHERE `scd`.`ring_game_id` = `ring_game`.`id` LIMIT 1) WHERE `room_id` IS NULL AND `user_id` IS NULL;--> statement-breakpoint
CREATE INDEX `ringGame_userId_idx` ON `ring_game` (`user_id`);
