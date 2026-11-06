WITH numbered AS MATERIALIZED (SELECT id, row_number() OVER (PARTITION BY play_session_id ORDER BY hand_no, id) AS seq FROM hand)
UPDATE hand SET seq = (SELECT seq FROM numbered WHERE numbered.id = hand.id);--> statement-breakpoint
UPDATE play_session SET next_hand_seq = coalesce((SELECT max(seq) FROM hand WHERE hand.play_session_id = play_session.id), 0);--> statement-breakpoint
CREATE UNIQUE INDEX `hand_play_session_seq_unique` ON `hand` (`play_session_id`,`seq`);
