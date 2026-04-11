# Data Model: アップデートノート表示

**Feature**: 009-update-notes-display  
**Date**: 2026-04-11

## Entities

### UpdateNote (Static — フロントエンド定数)

アプリケーションの各バージョンのリリース情報。コードベース内にTypeScript定数として定義される。

| Field | Type | Description |
|-------|------|-------------|
| version | string (PK) | バージョン識別子（例: "1.2.0"） |
| releasedAt | string | リリース日（ISO 8601形式、例: "2026-04-01"） |
| title | string | アップデートのタイトル（英語） |
| changes | string[] | 変更内容のリスト（英語、各項目がアコーディオン内に表示される） |

**Validation Rules**:
- version: 一意でなければならない
- releasedAt: 有効な日付文字列
- title: 空文字列不可
- changes: 1件以上の変更内容が必要

**Ordering**: releasedAtの降順（新しい順）

---

### UpdateNoteView (DB — Cloudflare D1)

ユーザーがどのアップデートノートを確認したかを追跡するテーブル。

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | text | PK | UUID主キー |
| userId | text | FK → user.id, NOT NULL, ON DELETE CASCADE | ユーザーID |
| version | text | NOT NULL | 確認済みのバージョン識別子 |
| viewedAt | integer (timestamp) | NOT NULL, DEFAULT unixepoch() | 確認日時 |

**Indexes**:
- `update_note_view_user_id_idx` ON (userId)
- `update_note_view_user_version_idx` ON (userId, version) UNIQUE

**Relations**:
- UpdateNoteView → User: many-to-one (userId → user.id)
- User → UpdateNoteView: one-to-many

**Validation Rules**:
- userId + version の組み合わせが一意（同じバージョンの重複記録を防止）
- version はフロントエンドのUpdateNote定数に定義されたバージョンと一致すべき（ただし外部キー制約ではなくアプリケーションレベルで検証）

**State Transitions**:
- 未確認 → 確認済み: ユーザーがアコーディオンを展開した時にレコードが作成される（不可逆）

---

## Entity Relationships

```text
User (既存)
 └── has many → UpdateNoteView
                  └── references → UpdateNote (静的定数, version で照合)
```

## Notes

- UpdateNoteはDBテーブルではなく、フロントエンドの静的定数として管理
- UpdateNoteViewテーブルのみがDBマイグレーション対象
- 「未確認」状態はUpdateNoteViewにレコードが存在しないことで暗黙的に表現される（レコードの存在 = 確認済み）
