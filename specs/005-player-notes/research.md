# Research: プレイヤーメモ機能

## R-001: リッチテキストエディタの実装

**Decision**: `apps/web/src/components/ui/rich-text-editor.tsx` で Tiptap ベースの入力体験を提供する。

**Rationale**:
- `StarterKit` と `Link` だけで太字、見出し、リスト、リンクを現行要件どおりに扱える
- `editor.getHTML()` で HTML をそのまま保存できる
- `PlayerForm` に埋め込む形で、作成・編集フローを分けずに済む

## R-002: メモの保存先

**Decision**: メモは `player.memo` に単一 HTML テキストとして保存する。

**Rationale**:
- 現行実装は 1 プレイヤーにつき 1 メモのモデル
- `player` の CRUD と同じライフサイクルで扱える
- 別テーブルを増やすよりクエリとフォームがシンプル

## R-003: タグ色の扱い

**Decision**: タグ色は `TAG_COLOR_NAMES` のプリセットから選ぶ。

**Rationale**:
- `player_tag.color` に保存するのは色名文字列だけでよい
- フロントエンドの `ColorBadge` が Tailwind クラスに変換する
- カスタムカラー入力を入れずに、一覧とタグ管理の整合を保てる

## R-004: メモ表示の安全性

**Decision**: 一覧カードでは HTML を直接描画せず、許可リストでサニタイズした抜粋だけを表示する。

**Rationale**:
- プレイヤーカードは短い要約だけ必要
- `player-card.tsx` でタグ名、見出し、リンクなどの許可範囲を限定できる
- 編集時の完全な HTML はフォーム側で保持する

## R-005: 既存パターンとの整合性

**Decision**: Store / SessionTag の CRUD と `ResponsiveDialog` / `EntityListItem` のパターンを踏襲する。

**Rationale**:
- 一覧ページで作成・編集・削除をまとめる構成が既存 UI と揃う
- タグ管理は独立ダイアログ、割り当てはプレイヤーフォーム内という役割分担が明確
- optimistic update と query invalidation の流れを既存画面と合わせられる
