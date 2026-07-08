-- SA2-184 (SA2-157 バックフィル): 日跨ぎで終了 < 開始 のまま保存された既存
-- セッション行を +1日 補正する。書き込み時補正(computeSessionTimes)導入前に
-- 22:00開始→翌02:00終了 のような入力が ended_at < started_at として保存され、
-- プレー時間が負値表示＋サーバー統計から消失していた行が対象。
-- started_at / ended_at は integer(mode:"timestamp") = Unix 秒なので 86400 秒 = 1日。
-- WHERE で補正済み(ended_at >= started_at)の行は除外されるため再適用しても冪等。
UPDATE `game_session` SET `ended_at` = `ended_at` + 86400 WHERE `ended_at` IS NOT NULL AND `started_at` IS NOT NULL AND `ended_at` < `started_at`;
