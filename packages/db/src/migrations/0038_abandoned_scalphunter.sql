-- Keep the temporary custom-variant data until 0041 can translate it into the
-- normalized game_group/game_variant masters introduced by 0039.
ALTER TABLE `custom_game_variant` RENAME TO `__legacy_custom_game_variant`;
