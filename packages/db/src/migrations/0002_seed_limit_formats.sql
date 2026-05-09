-- Seed system limit_format rows (user_id IS NULL = system-provided, read-only).
-- Exactly 4 rows: NL, PL, FL, Stud.
INSERT INTO limit_format (user_id, name, blind1_label, blind2_label, blind3_label, blind4_label, sort_order, created_at, updated_at)
VALUES
  (NULL, 'NL',   'Small blind', 'Big blind',  'Straddle',   'Straddle2', 0, unixepoch(), unixepoch()),
  (NULL, 'PL',   'Small blind', 'Big blind',  'Straddle',   'Straddle2', 1, unixepoch(), unixepoch()),
  (NULL, 'FL',   'Small Bet',   'Big Bet',    NULL,          NULL,        2, unixepoch(), unixepoch()),
  (NULL, 'Stud', 'Bring in',    'Complete',   'Small Bet',  'Big Bet',   3, unixepoch(), unixepoch());
