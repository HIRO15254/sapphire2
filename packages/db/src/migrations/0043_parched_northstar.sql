CREATE INDEX `gameVariant_groupId_idx` ON `game_variant` (`group_id`);--> statement-breakpoint
CREATE INDEX `playerToPlayerTag_playerTagId_idx` ON `player_to_player_tag` (`player_tag_id`);--> statement-breakpoint
CREATE INDEX `ringGame_currencyId_idx` ON `ring_game` (`currency_id`);--> statement-breakpoint
CREATE INDEX `sessionToSessionTag_sessionTagId_idx` ON `session_to_session_tag` (`session_tag_id`);--> statement-breakpoint
CREATE INDEX `tournament_currencyId_idx` ON `tournament` (`currency_id`);