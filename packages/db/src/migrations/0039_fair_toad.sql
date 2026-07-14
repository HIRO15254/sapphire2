CREATE TABLE `game_group` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`builtin_key` text,
	`label` text NOT NULL,
	`blind1_label` text,
	`blind2_label` text,
	`blind3_label` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `gameGroup_userId_idx` ON `game_group` (`user_id`);--> statement-breakpoint
CREATE TABLE `game_variant` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`builtin_key` text,
	`label` text NOT NULL,
	`short_label` text,
	`group_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `game_group`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `gameVariant_userId_idx` ON `game_variant` (`user_id`);
--> statement-breakpoint
-- ---------------------------------------------------------------------------
-- Backfill: seed the default game groups/variants for EXISTING users and
-- convert legacy preset keys stored in variant columns to display labels.
-- New users are seeded by the auth user.create hook; every statement below
-- is guarded so re-running (or racing the hook) never duplicates rows.
-- ---------------------------------------------------------------------------
INSERT INTO game_group (id, user_id, builtin_key, label, blind1_label, blind2_label, blind3_label, created_at, updated_at)
SELECT lower(hex(randomblob(16))), u.id, 'limit', 'Limit', 'Small Bet', 'Big Bet', NULL, unixepoch(), unixepoch()
FROM user u
WHERE NOT EXISTS (SELECT 1 FROM game_group gg WHERE gg.user_id = u.id AND gg.builtin_key = 'limit');
--> statement-breakpoint
INSERT INTO game_group (id, user_id, builtin_key, label, blind1_label, blind2_label, blind3_label, created_at, updated_at)
SELECT lower(hex(randomblob(16))), u.id, 'stud', 'Stud', 'Small Bet', 'Big Bet', 'Bring-in', unixepoch(), unixepoch()
FROM user u
WHERE NOT EXISTS (SELECT 1 FROM game_group gg WHERE gg.user_id = u.id AND gg.builtin_key = 'stud');
--> statement-breakpoint
INSERT INTO game_group (id, user_id, builtin_key, label, blind1_label, blind2_label, blind3_label, created_at, updated_at)
SELECT lower(hex(randomblob(16))), u.id, 'bigbet', 'Big Bet', 'SB', 'BB', 'Straddle', unixepoch(), unixepoch()
FROM user u
WHERE NOT EXISTS (SELECT 1 FROM game_group gg WHERE gg.user_id = u.id AND gg.builtin_key = 'bigbet');
--> statement-breakpoint
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at)
SELECT lower(hex(randomblob(16))), g.user_id, 'nlh', 'NL Hold''em', 'NLH', g.id, 0, unixepoch(), unixepoch()
FROM game_group g
WHERE g.builtin_key = 'bigbet'
  AND NOT EXISTS (SELECT 1 FROM game_variant gv WHERE gv.user_id = g.user_id AND gv.builtin_key = 'nlh');
--> statement-breakpoint
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at)
SELECT lower(hex(randomblob(16))), g.user_id, 'plhe', 'Pot Limit Hold''em', 'PLHE', g.id, 1, unixepoch(), unixepoch()
FROM game_group g
WHERE g.builtin_key = 'bigbet'
  AND NOT EXISTS (SELECT 1 FROM game_variant gv WHERE gv.user_id = g.user_id AND gv.builtin_key = 'plhe');
--> statement-breakpoint
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at)
SELECT lower(hex(randomblob(16))), g.user_id, 'plo', 'Pot Limit Omaha', 'PLO', g.id, 2, unixepoch(), unixepoch()
FROM game_group g
WHERE g.builtin_key = 'bigbet'
  AND NOT EXISTS (SELECT 1 FROM game_variant gv WHERE gv.user_id = g.user_id AND gv.builtin_key = 'plo');
--> statement-breakpoint
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at)
SELECT lower(hex(randomblob(16))), g.user_id, 'plo5', '5 Card PLO', 'PLO5', g.id, 3, unixepoch(), unixepoch()
FROM game_group g
WHERE g.builtin_key = 'bigbet'
  AND NOT EXISTS (SELECT 1 FROM game_variant gv WHERE gv.user_id = g.user_id AND gv.builtin_key = 'plo5');
--> statement-breakpoint
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at)
SELECT lower(hex(randomblob(16))), g.user_id, 'plo8', 'Pot Limit Omaha Hi-Lo', 'PLO8', g.id, 4, unixepoch(), unixepoch()
FROM game_group g
WHERE g.builtin_key = 'bigbet'
  AND NOT EXISTS (SELECT 1 FROM game_variant gv WHERE gv.user_id = g.user_id AND gv.builtin_key = 'plo8');
--> statement-breakpoint
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at)
SELECT lower(hex(randomblob(16))), g.user_id, 'bigo', 'Big O', 'Big O', g.id, 5, unixepoch(), unixepoch()
FROM game_group g
WHERE g.builtin_key = 'bigbet'
  AND NOT EXISTS (SELECT 1 FROM game_variant gv WHERE gv.user_id = g.user_id AND gv.builtin_key = 'bigo');
--> statement-breakpoint
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at)
SELECT lower(hex(randomblob(16))), g.user_id, 'shortdeck', 'Short Deck', '6+', g.id, 6, unixepoch(), unixepoch()
FROM game_group g
WHERE g.builtin_key = 'bigbet'
  AND NOT EXISTS (SELECT 1 FROM game_variant gv WHERE gv.user_id = g.user_id AND gv.builtin_key = 'shortdeck');
--> statement-breakpoint
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at)
SELECT lower(hex(randomblob(16))), g.user_id, '27sd', 'NL 2-7 Single Draw', '2-7SD', g.id, 7, unixepoch(), unixepoch()
FROM game_group g
WHERE g.builtin_key = 'bigbet'
  AND NOT EXISTS (SELECT 1 FROM game_variant gv WHERE gv.user_id = g.user_id AND gv.builtin_key = '27sd');
--> statement-breakpoint
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at)
SELECT lower(hex(randomblob(16))), g.user_id, 'pl27td', 'PL 2-7 Triple Draw', 'PL 2-7TD', g.id, 8, unixepoch(), unixepoch()
FROM game_group g
WHERE g.builtin_key = 'bigbet'
  AND NOT EXISTS (SELECT 1 FROM game_variant gv WHERE gv.user_id = g.user_id AND gv.builtin_key = 'pl27td');
--> statement-breakpoint
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at)
SELECT lower(hex(randomblob(16))), g.user_id, 'courchevel', 'Courchevel', 'Courchevel', g.id, 9, unixepoch(), unixepoch()
FROM game_group g
WHERE g.builtin_key = 'bigbet'
  AND NOT EXISTS (SELECT 1 FROM game_variant gv WHERE gv.user_id = g.user_id AND gv.builtin_key = 'courchevel');
--> statement-breakpoint
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at)
SELECT lower(hex(randomblob(16))), g.user_id, 'lhe', 'Limit Hold''em', 'LHE', g.id, 10, unixepoch(), unixepoch()
FROM game_group g
WHERE g.builtin_key = 'limit'
  AND NOT EXISTS (SELECT 1 FROM game_variant gv WHERE gv.user_id = g.user_id AND gv.builtin_key = 'lhe');
--> statement-breakpoint
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at)
SELECT lower(hex(randomblob(16))), g.user_id, 'lo', 'Limit Omaha', 'LO', g.id, 11, unixepoch(), unixepoch()
FROM game_group g
WHERE g.builtin_key = 'limit'
  AND NOT EXISTS (SELECT 1 FROM game_variant gv WHERE gv.user_id = g.user_id AND gv.builtin_key = 'lo');
--> statement-breakpoint
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at)
SELECT lower(hex(randomblob(16))), g.user_id, 'o8', 'Limit Omaha Hi-Lo', 'O8', g.id, 12, unixepoch(), unixepoch()
FROM game_group g
WHERE g.builtin_key = 'limit'
  AND NOT EXISTS (SELECT 1 FROM game_variant gv WHERE gv.user_id = g.user_id AND gv.builtin_key = 'o8');
--> statement-breakpoint
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at)
SELECT lower(hex(randomblob(16))), g.user_id, '27td', 'Limit 2-7 Triple Draw', '2-7TD', g.id, 13, unixepoch(), unixepoch()
FROM game_group g
WHERE g.builtin_key = 'limit'
  AND NOT EXISTS (SELECT 1 FROM game_variant gv WHERE gv.user_id = g.user_id AND gv.builtin_key = '27td');
--> statement-breakpoint
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at)
SELECT lower(hex(randomblob(16))), g.user_id, 'a5td', 'A-5 Triple Draw', 'A-5TD', g.id, 14, unixepoch(), unixepoch()
FROM game_group g
WHERE g.builtin_key = 'limit'
  AND NOT EXISTS (SELECT 1 FROM game_variant gv WHERE gv.user_id = g.user_id AND gv.builtin_key = 'a5td');
--> statement-breakpoint
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at)
SELECT lower(hex(randomblob(16))), g.user_id, 'badugi', 'Badugi', 'Badugi', g.id, 15, unixepoch(), unixepoch()
FROM game_group g
WHERE g.builtin_key = 'limit'
  AND NOT EXISTS (SELECT 1 FROM game_variant gv WHERE gv.user_id = g.user_id AND gv.builtin_key = 'badugi');
--> statement-breakpoint
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at)
SELECT lower(hex(randomblob(16))), g.user_id, 'badeucy', 'Badeucy', 'Badeucy', g.id, 16, unixepoch(), unixepoch()
FROM game_group g
WHERE g.builtin_key = 'limit'
  AND NOT EXISTS (SELECT 1 FROM game_variant gv WHERE gv.user_id = g.user_id AND gv.builtin_key = 'badeucy');
--> statement-breakpoint
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at)
SELECT lower(hex(randomblob(16))), g.user_id, 'badacy', 'Badacy', 'Badacy', g.id, 17, unixepoch(), unixepoch()
FROM game_group g
WHERE g.builtin_key = 'limit'
  AND NOT EXISTS (SELECT 1 FROM game_variant gv WHERE gv.user_id = g.user_id AND gv.builtin_key = 'badacy');
--> statement-breakpoint
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at)
SELECT lower(hex(randomblob(16))), g.user_id, 'stud', 'Seven Card Stud', 'Stud', g.id, 18, unixepoch(), unixepoch()
FROM game_group g
WHERE g.builtin_key = 'stud'
  AND NOT EXISTS (SELECT 1 FROM game_variant gv WHERE gv.user_id = g.user_id AND gv.builtin_key = 'stud');
--> statement-breakpoint
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at)
SELECT lower(hex(randomblob(16))), g.user_id, 'stud8', 'Stud Hi-Lo', 'Stud8', g.id, 19, unixepoch(), unixepoch()
FROM game_group g
WHERE g.builtin_key = 'stud'
  AND NOT EXISTS (SELECT 1 FROM game_variant gv WHERE gv.user_id = g.user_id AND gv.builtin_key = 'stud8');
--> statement-breakpoint
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at)
SELECT lower(hex(randomblob(16))), g.user_id, 'razz', 'Razz', 'Razz', g.id, 20, unixepoch(), unixepoch()
FROM game_group g
WHERE g.builtin_key = 'stud'
  AND NOT EXISTS (SELECT 1 FROM game_variant gv WHERE gv.user_id = g.user_id AND gv.builtin_key = 'razz');
--> statement-breakpoint
UPDATE ring_game SET variant = CASE variant WHEN 'nlh' THEN 'NL Hold''em' WHEN 'plo' THEN 'Pot Limit Omaha' WHEN 'plo5' THEN '5 Card PLO' WHEN 'plo8' THEN 'Pot Limit Omaha Hi-Lo' WHEN 'bigo' THEN 'Big O' WHEN 'shortdeck' THEN 'Short Deck' WHEN '27sd' THEN 'NL 2-7 Single Draw' WHEN 'lhe' THEN 'Limit Hold''em' WHEN 'o8' THEN 'Limit Omaha Hi-Lo' WHEN '27td' THEN 'Limit 2-7 Triple Draw' WHEN 'badugi' THEN 'Badugi' WHEN 'stud' THEN 'Seven Card Stud' WHEN 'stud8' THEN 'Stud Hi-Lo' WHEN 'razz' THEN 'Razz' ELSE variant END WHERE variant IN ('nlh', 'plo', 'plo5', 'plo8', 'bigo', 'shortdeck', '27sd', 'lhe', 'o8', '27td', 'badugi', 'stud', 'stud8', 'razz');
--> statement-breakpoint
UPDATE tournament SET variant = CASE variant WHEN 'nlh' THEN 'NL Hold''em' WHEN 'plo' THEN 'Pot Limit Omaha' WHEN 'plo5' THEN '5 Card PLO' WHEN 'plo8' THEN 'Pot Limit Omaha Hi-Lo' WHEN 'bigo' THEN 'Big O' WHEN 'shortdeck' THEN 'Short Deck' WHEN '27sd' THEN 'NL 2-7 Single Draw' WHEN 'lhe' THEN 'Limit Hold''em' WHEN 'o8' THEN 'Limit Omaha Hi-Lo' WHEN '27td' THEN 'Limit 2-7 Triple Draw' WHEN 'badugi' THEN 'Badugi' WHEN 'stud' THEN 'Seven Card Stud' WHEN 'stud8' THEN 'Stud Hi-Lo' WHEN 'razz' THEN 'Razz' ELSE variant END WHERE variant IN ('nlh', 'plo', 'plo5', 'plo8', 'bigo', 'shortdeck', '27sd', 'lhe', 'o8', '27td', 'badugi', 'stud', 'stud8', 'razz');
--> statement-breakpoint
UPDATE session_cash_detail SET variant = CASE variant WHEN 'nlh' THEN 'NL Hold''em' WHEN 'plo' THEN 'Pot Limit Omaha' WHEN 'plo5' THEN '5 Card PLO' WHEN 'plo8' THEN 'Pot Limit Omaha Hi-Lo' WHEN 'bigo' THEN 'Big O' WHEN 'shortdeck' THEN 'Short Deck' WHEN '27sd' THEN 'NL 2-7 Single Draw' WHEN 'lhe' THEN 'Limit Hold''em' WHEN 'o8' THEN 'Limit Omaha Hi-Lo' WHEN '27td' THEN 'Limit 2-7 Triple Draw' WHEN 'badugi' THEN 'Badugi' WHEN 'stud' THEN 'Seven Card Stud' WHEN 'stud8' THEN 'Stud Hi-Lo' WHEN 'razz' THEN 'Razz' ELSE variant END WHERE variant IN ('nlh', 'plo', 'plo5', 'plo8', 'bigo', 'shortdeck', '27sd', 'lhe', 'o8', '27td', 'badugi', 'stud', 'stud8', 'razz');
--> statement-breakpoint
UPDATE session_tournament_detail SET variant = CASE variant WHEN 'nlh' THEN 'NL Hold''em' WHEN 'plo' THEN 'Pot Limit Omaha' WHEN 'plo5' THEN '5 Card PLO' WHEN 'plo8' THEN 'Pot Limit Omaha Hi-Lo' WHEN 'bigo' THEN 'Big O' WHEN 'shortdeck' THEN 'Short Deck' WHEN '27sd' THEN 'NL 2-7 Single Draw' WHEN 'lhe' THEN 'Limit Hold''em' WHEN 'o8' THEN 'Limit Omaha Hi-Lo' WHEN '27td' THEN 'Limit 2-7 Triple Draw' WHEN 'badugi' THEN 'Badugi' WHEN 'stud' THEN 'Seven Card Stud' WHEN 'stud8' THEN 'Stud Hi-Lo' WHEN 'razz' THEN 'Razz' ELSE variant END WHERE variant IN ('nlh', 'plo', 'plo5', 'plo8', 'bigo', 'shortdeck', '27sd', 'lhe', 'o8', '27td', 'badugi', 'stud', 'stud8', 'razz');
