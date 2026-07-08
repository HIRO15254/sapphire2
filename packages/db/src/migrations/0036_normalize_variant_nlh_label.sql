-- User-defined game variants (SA2-192): the default seeded variant is now
-- named "NLH" (matches the other seeded variant names like "PLO", "LHE").
-- Existing rows across the 4 variant text columns still carry the old
-- lowercase "nlh" literal (the previous Drizzle column default); normalize
-- them so free-text variant values line up with the new default label.
-- Idempotent: rows already carrying "NLH" are excluded by the WHERE clause.
UPDATE `ring_game` SET `variant` = 'NLH' WHERE `variant` = 'nlh';--> statement-breakpoint
UPDATE `tournament` SET `variant` = 'NLH' WHERE `variant` = 'nlh';--> statement-breakpoint
UPDATE `session_cash_detail` SET `variant` = 'NLH' WHERE `variant` = 'nlh';--> statement-breakpoint
UPDATE `session_tournament_detail` SET `variant` = 'NLH' WHERE `variant` = 'nlh';
