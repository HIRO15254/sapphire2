CREATE TABLE `__gate_0068` (`big_bet_blind3` integer NOT NULL DEFAULT 1);--> statement-breakpoint
INSERT INTO `__gate_0068` (`big_bet_blind3`) SELECT NULL WHERE EXISTS (
 SELECT 1 FROM `cash_rule_stake` s
 JOIN `game_lineup_group` lg ON lg.id=s.lineup_group_id AND lg.user_id=s.user_id
 JOIN `game_group` g ON g.id=lg.game_group_id AND g.user_id=lg.user_id
 WHERE g.builtin_key='bigbet' AND s.blind3 IS NOT NULL
) OR EXISTS (
 SELECT 1 FROM `tournament_rule_level_stake` s
 JOIN `game_lineup_group` lg ON lg.id=s.lineup_group_id AND lg.user_id=s.user_id
 JOIN `game_group` g ON g.id=lg.game_group_id AND g.user_id=lg.user_id
 WHERE g.builtin_key='bigbet' AND s.blind3 IS NOT NULL
);--> statement-breakpoint
ALTER TABLE `game_group` ADD `blind1_required` integer DEFAULT false NOT NULL CONSTRAINT "game_group_blind1_required_check" CHECK("blind1_required" IN (0, 1));--> statement-breakpoint
ALTER TABLE `game_group` ADD `blind2_required` integer DEFAULT false NOT NULL CONSTRAINT "game_group_blind2_required_check" CHECK("blind2_required" IN (0, 1));--> statement-breakpoint
ALTER TABLE `game_group` ADD `blind3_required` integer DEFAULT false NOT NULL CONSTRAINT "game_group_blind3_required_check" CHECK("blind3_required" IN (0, 1));--> statement-breakpoint
UPDATE `game_group` SET `blind3_label`=NULL WHERE `builtin_key`='bigbet' AND `blind3_label`='Straddle';--> statement-breakpoint
UPDATE `game_group` SET `blind1_required`=(`blind1_label` IS NOT NULL), `blind2_required`=(`blind2_label` IS NOT NULL) WHERE `builtin_key` IN ('limit','stud','bigbet');--> statement-breakpoint
DROP TABLE `__gate_0068`;
