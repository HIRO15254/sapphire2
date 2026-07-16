CREATE TABLE `game_mix` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`builtin_key` text,
	`label` text NOT NULL,
	`games` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `gameMix_userId_idx` ON `game_mix` (`user_id`);
--> statement-breakpoint
-- ---------------------------------------------------------------------------
-- Backfill: seed the default mix masters for EXISTING users (new users get
-- them from the auth user.create hook). `games` is the ordered JSON array of
-- the user's own game_variant ids resolved via builtin_key; users without
-- any variants are skipped (empty accounts self-seed on first list call).
-- ---------------------------------------------------------------------------
INSERT INTO game_mix (id, user_id, builtin_key, label, games, created_at, updated_at)
SELECT lower(hex(randomblob(16))), u.id, 'horse', 'HORSE',
  (SELECT json_group_array(id) FROM (
     SELECT gv.id FROM game_variant gv
     WHERE gv.user_id = u.id AND gv.builtin_key IN ('lhe', 'o8', 'razz', 'stud', 'stud8')
     ORDER BY CASE gv.builtin_key WHEN 'lhe' THEN 0 WHEN 'o8' THEN 1 WHEN 'razz' THEN 2 WHEN 'stud' THEN 3 WHEN 'stud8' THEN 4 END
  )),
  unixepoch(), unixepoch()
FROM user u
WHERE NOT EXISTS (SELECT 1 FROM game_mix gm WHERE gm.user_id = u.id AND gm.builtin_key = 'horse')
  AND EXISTS (SELECT 1 FROM game_variant gv2 WHERE gv2.user_id = u.id);
--> statement-breakpoint
INSERT INTO game_mix (id, user_id, builtin_key, label, games, created_at, updated_at)
SELECT lower(hex(randomblob(16))), u.id, '8game', '8-Game',
  (SELECT json_group_array(id) FROM (
     SELECT gv.id FROM game_variant gv
     WHERE gv.user_id = u.id AND gv.builtin_key IN ('27td', 'lhe', 'o8', 'razz', 'stud', 'stud8', 'nlh', 'plo')
     ORDER BY CASE gv.builtin_key WHEN '27td' THEN 0 WHEN 'lhe' THEN 1 WHEN 'o8' THEN 2 WHEN 'razz' THEN 3 WHEN 'stud' THEN 4 WHEN 'stud8' THEN 5 WHEN 'nlh' THEN 6 WHEN 'plo' THEN 7 END
  )),
  unixepoch(), unixepoch()
FROM user u
WHERE NOT EXISTS (SELECT 1 FROM game_mix gm WHERE gm.user_id = u.id AND gm.builtin_key = '8game')
  AND EXISTS (SELECT 1 FROM game_variant gv2 WHERE gv2.user_id = u.id);
--> statement-breakpoint
INSERT INTO game_mix (id, user_id, builtin_key, label, games, created_at, updated_at)
SELECT lower(hex(randomblob(16))), u.id, '10game', '10-Game',
  (SELECT json_group_array(id) FROM (
     SELECT gv.id FROM game_variant gv
     WHERE gv.user_id = u.id AND gv.builtin_key IN ('27td', 'lhe', 'o8', 'badugi', 'razz', 'stud', 'stud8', 'nlh', 'plo', '27sd')
     ORDER BY CASE gv.builtin_key WHEN '27td' THEN 0 WHEN 'lhe' THEN 1 WHEN 'o8' THEN 2 WHEN 'badugi' THEN 3 WHEN 'razz' THEN 4 WHEN 'stud' THEN 5 WHEN 'stud8' THEN 6 WHEN 'nlh' THEN 7 WHEN 'plo' THEN 8 WHEN '27sd' THEN 9 END
  )),
  unixepoch(), unixepoch()
FROM user u
WHERE NOT EXISTS (SELECT 1 FROM game_mix gm WHERE gm.user_id = u.id AND gm.builtin_key = '10game')
  AND EXISTS (SELECT 1 FROM game_variant gv2 WHERE gv2.user_id = u.id);
