-- Seed system variant rows (user_id IS NULL = system-provided, read-only).
-- Single-variant games: sort_order 0–99. MIX games: sort_order 100+.
INSERT INTO variant (user_id, name, sort_order, created_at, updated_at)
VALUES
  -- single variants
  (NULL, 'No-Limit Hold''em',          0,   unixepoch(), unixepoch()),
  (NULL, 'Pot-Limit Hold''em',         1,   unixepoch(), unixepoch()),
  (NULL, 'Fixed-Limit Hold''em',       2,   unixepoch(), unixepoch()),
  (NULL, 'Pot-Limit Omaha',            3,   unixepoch(), unixepoch()),
  (NULL, 'Pot-Limit Omaha Hi-Lo',      4,   unixepoch(), unixepoch()),
  (NULL, 'Fixed-Limit Omaha Hi-Lo',    5,   unixepoch(), unixepoch()),
  (NULL, 'Big O (5-Card PLO)',         6,   unixepoch(), unixepoch()),
  (NULL, 'Short Deck Hold''em',        7,   unixepoch(), unixepoch()),
  (NULL, 'Seven-Card Stud',            8,   unixepoch(), unixepoch()),
  (NULL, 'Seven-Card Stud Hi-Lo',      9,   unixepoch(), unixepoch()),
  (NULL, 'Razz',                       10,  unixepoch(), unixepoch()),
  (NULL, '2-7 Triple Draw',            11,  unixepoch(), unixepoch()),
  (NULL, '2-7 Single Draw',            12,  unixepoch(), unixepoch()),
  (NULL, 'A-5 Triple Draw',            13,  unixepoch(), unixepoch()),
  (NULL, 'Badugi',                     14,  unixepoch(), unixepoch()),
  (NULL, 'Badeucy',                    15,  unixepoch(), unixepoch()),
  (NULL, 'Badacey',                    16,  unixepoch(), unixepoch()),
  (NULL, '5-Card Draw',                17,  unixepoch(), unixepoch()),
  (NULL, 'Open-Face Chinese',          18,  unixepoch(), unixepoch()),
  (NULL, 'Pineapple OFC',              19,  unixepoch(), unixepoch()),
  -- MIX variants
  (NULL, 'H.O.R.S.E.',                 100, unixepoch(), unixepoch()),
  (NULL, 'H.O.E.',                     101, unixepoch(), unixepoch()),
  (NULL, 'H.A.',                       102, unixepoch(), unixepoch()),
  (NULL, '8-Game',                     103, unixepoch(), unixepoch()),
  (NULL, '10-Game',                    104, unixepoch(), unixepoch()),
  (NULL, 'Mixed NL/PLO',               105, unixepoch(), unixepoch()),
  (NULL, 'Dealer''s Choice',           106, unixepoch(), unixepoch());
