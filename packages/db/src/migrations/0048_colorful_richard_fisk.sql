-- このマイグレーションの `IF NOT EXISTS` は意図的な手編集。drizzle-kit が生成する
-- 素の DDL (`CREATE TABLE` / `CREATE INDEX`) とは異なる点に注意。
-- 経緯: 本 PR は当初 0047 として生成され、プレビュー用 D1 に適用済みだった。
-- その後 dev 側で無関係な 0047 がマージされたため 0048 に再採番したところ、
-- wrangler は 0048 を未適用と判断し、filter_preset が既に存在する DB に対して
-- 同じ DDL を再実行してしまう (d1_migrations は適用済みファイル名で追跡するため)。
-- Cloudflare の認証情報を持たない環境ではプレビュー DB のリセットができないので、
-- ガードを付けて冪等化している。
-- なお、このファイルを将来 drizzle-kit で再生成するとガードは失われる。
CREATE TABLE IF NOT EXISTS `filter_preset` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`screen_key` text NOT NULL,
	`name` text NOT NULL,
	`payload` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `filterPreset_userId_idx` ON `filter_preset` (`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `filterPreset_userId_screenKey_idx` ON `filter_preset` (`user_id`,`screen_key`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `filterPreset_userId_screenKey_name_idx` ON `filter_preset` (`user_id`,`screen_key`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `filterPreset_userId_screenKey_defaultUnique_idx` ON `filter_preset` (`user_id`,`screen_key`) WHERE "filter_preset"."is_default" = 1;