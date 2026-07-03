-- SA2-41: 緯度・経度を room テーブルに追加。ライブセッション開始時に位置情報から
-- 最寄りの room をデフォルト選択するために使用する。NULL 許容（既存行・未設定の
-- room は位置情報なし。(0, 0) は有効な座標なので「未設定」には使えないため）。
ALTER TABLE room ADD COLUMN latitude REAL;--> statement-breakpoint
ALTER TABLE room ADD COLUMN longitude REAL;
