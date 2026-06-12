-- SA2-24: is_favorite フラグを currency テーブルに追加（デフォルト 0 = 未登録）
ALTER TABLE currency ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;
