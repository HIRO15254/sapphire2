ALTER TABLE `ring_game` ADD `house_rules` text;--> statement-breakpoint
ALTER TABLE `session_cash_detail` ADD `house_rules` text;--> statement-breakpoint
ALTER TABLE `session_tournament_detail` ADD `house_rules` text;--> statement-breakpoint
ALTER TABLE `game_session` ADD `hand_count` integer;--> statement-breakpoint
ALTER TABLE `game_session` ADD `dealer_offset` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tournament` ADD `house_rules` text;