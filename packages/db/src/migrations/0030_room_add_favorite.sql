-- SA2-47: is_favorite フラグを room テーブルに追加（デフォルト 0 = 未登録）
ALTER TABLE room ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;
