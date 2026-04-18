-- Migration: Add ended_before_registration_close flag to poker_session
-- Records whether a tournament session ended before registration close.
-- NULL for cash games and untagged tournaments, true/false for tagged tournaments.
ALTER TABLE `poker_session` ADD `ended_before_registration_close` integer;
