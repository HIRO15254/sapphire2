# tRPC Router Contract: updateNoteView

**Feature**: 009-update-notes-display  
**Date**: 2026-04-11

## Router: `updateNoteView`

Namespace: `trpc.updateNoteView.*`

### Procedures

#### `updateNoteView.list` (query, protected)

ログインユーザーの全確認済みバージョンのリストを返す。

**Input**: なし

**Output**:
```
Array<{
  id: string
  version: string
  viewedAt: Date
}>
```

**Behavior**:
- `ctx.session.user.id` で絞り込み
- viewedAtの降順で返す

---

#### `updateNoteView.markViewed` (mutation, protected)

指定バージョンを確認済みとして記録する。

**Input**:
```
{
  version: string  // required, min 1 char
}
```

**Output**:
```
{
  id: string
  version: string
  viewedAt: Date
}
```

**Behavior**:
- userId + version の組み合わせが既に存在する場合、既存レコードを返す（冪等性）
- 存在しない場合、新規レコードを作成して返す
- `onConflictDoNothing` または事前チェックで重複を防止

**Error Cases**:
- UNAUTHORIZED: 未認証ユーザー（protectedProcedure が処理）

---

#### `updateNoteView.getLatestViewedVersion` (query, protected)

ログインユーザーが最後に確認したバージョンを返す。自動表示のトリガー判定に使用。

**Input**: なし

**Output**:
```
{
  version: string | null  // 一度も確認していない場合はnull
  viewedAt: Date | null
}
```

**Behavior**:
- `ctx.session.user.id` で絞り込み
- viewedAtの降順で最初の1件を返す
- レコードが存在しない場合は `{ version: null, viewedAt: null }` を返す
