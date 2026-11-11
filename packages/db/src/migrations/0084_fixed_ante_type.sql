ALTER TABLE `game_group` ADD `fixed_ante_type` text CONSTRAINT "game_group_fixed_ante_type_check" CHECK("fixed_ante_type" IN ('none', 'all', 'bb'));--> statement-breakpoint
UPDATE `game_group` SET `fixed_ante_type`='all' WHERE `builtin_key`='stud';--> statement-breakpoint
UPDATE `cash_rule_stake` SET `ante_type`='all' WHERE `ante_type` IS NOT 'all' AND EXISTS (
 SELECT 1 FROM `game_lineup_group` lg
 JOIN `game_group` g ON g.id=lg.game_group_id AND g.user_id=lg.user_id
 WHERE lg.id=`cash_rule_stake`.lineup_group_id AND lg.user_id=`cash_rule_stake`.user_id AND g.builtin_key='stud'
);--> statement-breakpoint
UPDATE `tournament_rule_level_stake` SET `ante_type`='all' WHERE `ante_type` IS NOT 'all' AND EXISTS (
 SELECT 1 FROM `game_lineup_group` lg
 JOIN `game_group` g ON g.id=lg.game_group_id AND g.user_id=lg.user_id
 WHERE lg.id=`tournament_rule_level_stake`.lineup_group_id AND lg.user_id=`tournament_rule_level_stake`.user_id AND g.builtin_key='stud'
);
