ALTER TABLE `session_cash_detail` ADD `chip_remove_total` integer;
--> statement-breakpoint
-- チップ除去 (chips_add_remove の負値イベント) 分が完了済みセッションのP/Lに
-- 反映されないバグの遡及修正。session_cash_detail に chip_remove_total を
-- 保存していなかったため、一覧・詳細・統計側の再計算 (cashOut - buyIn) が
-- チップ除去分を無視していた。既存行の chip_remove_total を session_event
-- から再構成する。冪等 (何度再実行しても同じ値になる)。
UPDATE `session_cash_detail`
SET `chip_remove_total` = (
	SELECT COALESCE(SUM(-CAST(json_extract(`session_event`.`payload`, '$.amount') AS INTEGER)), 0)
	FROM `session_event`
	WHERE `session_event`.`session_id` = `session_cash_detail`.`session_id`
		AND `session_event`.`event_type` = 'chips_add_remove'
		AND CAST(json_extract(`session_event`.`payload`, '$.amount') AS INTEGER) < 0
);
--> statement-breakpoint
-- 上のバックフィルで chip_remove_total が確定した完了済みセッション全件に
-- ついて、currency_transaction.amount を正しい P/L (cashOut + chipRemoveTotal
-- - buyIn) に再同期する。完了後の編集 (session.update) でチップ除去抜きの
-- 値に上書きされていた行はここで修正され、未編集の行は元々の正しい値を
-- 再計算するだけなので無害 (= 冪等)。chip_remove_total = 0 の行はそもそも
-- 影響を受けていないため対象外。
UPDATE `currency_transaction`
SET `amount` = (
	SELECT `session_cash_detail`.`cash_out` + `session_cash_detail`.`chip_remove_total` - `session_cash_detail`.`buy_in`
	FROM `session_cash_detail`
	JOIN `game_session` ON `game_session`.`id` = `session_cash_detail`.`session_id`
	WHERE `session_cash_detail`.`session_id` = `currency_transaction`.`session_id`
		AND `game_session`.`status` = 'completed'
		AND `session_cash_detail`.`buy_in` IS NOT NULL
		AND `session_cash_detail`.`cash_out` IS NOT NULL
)
WHERE `session_id` IN (
	SELECT `session_cash_detail`.`session_id`
	FROM `session_cash_detail`
	JOIN `game_session` ON `game_session`.`id` = `session_cash_detail`.`session_id`
	WHERE `game_session`.`status` = 'completed'
		AND `session_cash_detail`.`buy_in` IS NOT NULL
		AND `session_cash_detail`.`cash_out` IS NOT NULL
		AND `session_cash_detail`.`chip_remove_total` IS NOT NULL
		AND `session_cash_detail`.`chip_remove_total` != 0
);