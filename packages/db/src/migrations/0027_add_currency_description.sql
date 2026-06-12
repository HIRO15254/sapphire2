-- Each currency can carry an optional rich-text description (SA2-25),
-- stored as sanitized HTML in a nullable text column. Mirrors player.memo.

ALTER TABLE currency ADD COLUMN description TEXT;
