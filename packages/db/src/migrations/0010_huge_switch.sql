ALTER TABLE `live_cash_game_session` ADD `hero_seat_position` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `live_tournament_session` ADD `hero_seat_position` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `session_table_player` ADD `seat_position` integer;