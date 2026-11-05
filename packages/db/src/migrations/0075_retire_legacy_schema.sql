-- B25 (SA2-418): drop every retired legacy table child-first, game_mix.games, and the orphan
-- todo table from 0000; give the B18 tournament tag definitions their final name. No final table
-- references a retired one, so the drops cascade only into other retired tables.
-- Each gate inserts NULL into its own NOT NULL column of __gate_0075.
CREATE TABLE `__gate_0075` (
	`rows_preserved` INTEGER NOT NULL DEFAULT 1,
	`retired_removed` INTEGER NOT NULL DEFAULT 1,
	`inventory` INTEGER NOT NULL DEFAULT 1,
	`foreign_keys_valid` INTEGER NOT NULL DEFAULT 1
);--> statement-breakpoint
CREATE TABLE `__stage_0075_count` (
	`name` TEXT PRIMARY KEY NOT NULL,
	`rows` INTEGER NOT NULL
);--> statement-breakpoint
INSERT INTO `__stage_0075_count` (`name`, `rows`)
SELECT 'game_mix', count(*) FROM `game_mix`
UNION ALL SELECT 'game_mix_variant', count(*) FROM `game_mix_variant`
UNION ALL SELECT 'tournament_tag', count(*) FROM `tournament_tag_def`
UNION ALL SELECT 'tournament_tag_link', count(*) FROM `tournament_tag_link`;--> statement-breakpoint
DROP TABLE `session_chip_purchase_result`;--> statement-breakpoint
DROP TABLE `session_chip_purchase`;--> statement-breakpoint
DROP TABLE `session_blind_level`;--> statement-breakpoint
DROP TABLE `session_to_session_tag`;--> statement-breakpoint
DROP TABLE `currency_transaction`;--> statement-breakpoint
DROP TABLE `session_cash_detail`;--> statement-breakpoint
DROP TABLE `session_tournament_detail`;--> statement-breakpoint
DROP TABLE `session_event`;--> statement-breakpoint
DROP TABLE `game_session`;--> statement-breakpoint
DROP TABLE `session_tag`;--> statement-breakpoint
DROP TABLE `transaction_type`;--> statement-breakpoint
DROP TABLE `tournament_tag`;--> statement-breakpoint
DROP TABLE `player_to_player_tag`;--> statement-breakpoint
DROP TABLE `blind_level`;--> statement-breakpoint
DROP TABLE `tournament_chip_purchase`;--> statement-breakpoint
DROP TABLE `todo`;--> statement-breakpoint
ALTER TABLE `game_mix` DROP COLUMN `games`;--> statement-breakpoint
ALTER TABLE `tournament_tag_def` RENAME TO `tournament_tag`;--> statement-breakpoint
-- End checks.
INSERT INTO `__gate_0075` (`rows_preserved`) SELECT NULL WHERE EXISTS (
	SELECT 1 FROM `__stage_0075_count` s WHERE s.`rows` <> CASE s.`name`
		WHEN 'game_mix' THEN (SELECT count(*) FROM `game_mix`)
		WHEN 'game_mix_variant' THEN (SELECT count(*) FROM `game_mix_variant`)
		WHEN 'tournament_tag' THEN (SELECT count(*) FROM `tournament_tag`)
		WHEN 'tournament_tag_link' THEN (SELECT count(*) FROM `tournament_tag_link`)
	END
);--> statement-breakpoint
INSERT INTO `__gate_0075` (`retired_removed`) SELECT NULL WHERE EXISTS (
	SELECT 1 FROM pragma_table_info('game_mix') WHERE `name` = 'games'
) OR EXISTS (
	SELECT 1 FROM pragma_foreign_key_list('tournament_tag_link') WHERE `table` = 'tournament_tag_def'
) OR EXISTS (
	SELECT 1 FROM `sqlite_master` WHERE `type` IN ('view', 'trigger')
);--> statement-breakpoint
INSERT INTO `__gate_0075` (`inventory`) SELECT NULL WHERE EXISTS (
	SELECT 1 FROM `sqlite_master`
	WHERE `type` = 'table'
		AND `name` NOT LIKE 'sqlite\_%' ESCAPE '\'
		AND `name` NOT LIKE '\_cf\_%' ESCAPE '\'
		AND `name` NOT IN (
			'd1_migrations', '__gate_0075', '__stage_0075_count',
			'user', 'account', 'session', 'verification', 'passkey',
			'oauth_application', 'oauth_access_token', 'oauth_consent',
			'update_note_view',
			'asset', 'asset_rate', 'user_setting', 'ledger_category', 'ledger_line',
			'room', 'ring_game', 'tournament',
			'game_group', 'game_variant', 'game_mix', 'game_mix_variant',
			'game_lineup', 'game_lineup_group', 'game_lineup_variant',
			'cash_rule', 'cash_rule_stake',
			'tournament_rule', 'tournament_rule_level', 'tournament_rule_level_stake', 'tournament_rule_price',
			'entry', 'entry_cash', 'entry_tournament', 'play_session', 'play_event',
			'hand', 'hand_seat', 'hand_action', 'hand_board',
			'player', 'filter_preset',
			'entry_tag', 'entry_tag_link', 'tournament_tag', 'tournament_tag_link',
			'hand_tag', 'hand_tag_link', 'player_tag', 'player_tag_link'
		)
);--> statement-breakpoint
INSERT INTO `__gate_0075` (`foreign_keys_valid`) SELECT NULL WHERE EXISTS (SELECT 1 FROM pragma_foreign_key_check);--> statement-breakpoint
DROP TABLE `__stage_0075_count`;--> statement-breakpoint
DROP TABLE `__gate_0075`;
