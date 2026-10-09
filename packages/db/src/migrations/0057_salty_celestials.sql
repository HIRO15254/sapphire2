-- Data model v2, P3 prep (SA2-310): the hand history tables and the
-- play_event.hand_id exception column. Nothing writes them until T22.
--
-- hand_seat is created before hand_action so the (hand_id, seat) FK of an
-- action never names a parent table that is missing.
CREATE TABLE `hand` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`play_session_id` text NOT NULL,
	`hand_no` integer NOT NULL,
	`played_at` integer,
	`detail` text NOT NULL,
	`button_seat` integer,
	`table_size` integer,
	`level_ordinal` integer,
	`stakes` text,
	`variant_id` text,
	`board` text,
	`pot` integer,
	`hero_net` integer,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`play_session_id`,`user_id`) REFERENCES `play_session`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`,`user_id`) REFERENCES `game_variant`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "hand_hand_no_check" CHECK("hand"."hand_no" >= 1),
	CONSTRAINT "hand_detail_check" CHECK("hand"."detail" IN ('count', 'summary', 'full')),
	CONSTRAINT "hand_button_seat_check" CHECK("hand"."button_seat" BETWEEN 0 AND 9),
	CONSTRAINT "hand_table_size_check" CHECK("hand"."table_size" BETWEEN 2 AND 10),
	CONSTRAINT "hand_stakes_json_check" CHECK(json_valid("hand"."stakes")),
	CONSTRAINT "hand_board_length_check" CHECK(length("hand"."board") <= 14),
	CONSTRAINT "hand_pot_check" CHECK("hand"."pot" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hand_id_user_id_unique` ON `hand` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `hand_play_session_hand_no_unique` ON `hand` (`play_session_id`,`hand_no`);--> statement-breakpoint
CREATE INDEX `hand_user_played_at_idx` ON `hand` (`user_id`,`played_at`);--> statement-breakpoint
CREATE INDEX `hand_variant_idx` ON `hand` (`variant_id`);--> statement-breakpoint
CREATE TABLE `hand_seat` (
	`hand_id` text NOT NULL,
	`user_id` text NOT NULL,
	`seat` integer NOT NULL,
	`player_id` text,
	`is_hero` integer DEFAULT false NOT NULL,
	`start_stack` integer,
	`hole_cards` text,
	`net` integer,
	`showed` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`hand_id`, `seat`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hand_id`,`user_id`) REFERENCES `hand`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`,`user_id`) REFERENCES `player`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "hand_seat_seat_check" CHECK("hand_seat"."seat" BETWEEN 0 AND 9),
	CONSTRAINT "hand_seat_is_hero_check" CHECK("hand_seat"."is_hero" IN (0, 1)),
	CONSTRAINT "hand_seat_start_stack_check" CHECK("hand_seat"."start_stack" >= 0),
	CONSTRAINT "hand_seat_hole_cards_length_check" CHECK(length("hand_seat"."hole_cards") <= 20),
	CONSTRAINT "hand_seat_showed_check" CHECK("hand_seat"."showed" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hand_seat_one_hero_per_hand_idx` ON `hand_seat` (`hand_id`) WHERE "hand_seat"."is_hero" = 1;--> statement-breakpoint
CREATE INDEX `hand_seat_player_idx` ON `hand_seat` (`player_id`);--> statement-breakpoint
CREATE TABLE `hand_action` (
	`hand_id` text NOT NULL,
	`user_id` text NOT NULL,
	`seq` integer NOT NULL,
	`street` integer NOT NULL,
	`seat` integer NOT NULL,
	`action` text NOT NULL,
	`amount` integer,
	`all_in` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`hand_id`, `seq`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hand_id`,`user_id`) REFERENCES `hand`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hand_id`,`seat`) REFERENCES `hand_seat`(`hand_id`,`seat`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "hand_action_seq_check" CHECK("hand_action"."seq" >= 1),
	CONSTRAINT "hand_action_street_check" CHECK("hand_action"."street" BETWEEN 0 AND 7),
	CONSTRAINT "hand_action_action_check" CHECK("hand_action"."action" IN ('post', 'straddle', 'bring_in', 'fold', 'check', 'call', 'bet', 'raise', 'draw', 'show', 'muck')),
	CONSTRAINT "hand_action_amount_check" CHECK("hand_action"."amount" >= 0),
	CONSTRAINT "hand_action_all_in_check" CHECK("hand_action"."all_in" IN (0, 1))
);
--> statement-breakpoint
ALTER TABLE `play_event` ADD `hand_id` text REFERENCES hand(id);--> statement-breakpoint
CREATE INDEX `play_event_hand_idx` ON `play_event` (`hand_id`);