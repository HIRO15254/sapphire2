# Research: 002-store-currency-game

## R1: ID と所有権

**Decision**: 主要テーブルは `text` 型 UUID を主キーにする。
**Reason**: 既存 auth スキーマと揃えやすく、クライアント側で ID を先に持てる。

## R2: 削除とアーカイブ

**Decision**: 親子関係は外部キーで管理し、削除は cascade / set null を使う。
**Reason**: 店舗削除で関連データを自然に消し、通貨削除ではゲーム設定側の参照だけを外せる。

## R3: アーカイブの表現

**Decision**: `ring_game` と `tournament` は `archivedAt` を持つ。
**Reason**: null / 非null で一覧の既定表示を切り替えられる。

## R4: 通貨残高

**Decision**: 残高は保存せず、`currency_transaction` の合計から算出する。
**Reason**: 手動トランザクション数が少なく、整合性を崩しにくい。

## R5: 種別の初期化

**Decision**: `transactionType.list` の初回呼び出し時に既定値を作成する。
**Current defaults**: `Purchase`, `Bonus`, `Session Result`, `Other`

## R6: ゲーム定義

**Decision**: バリアントはコード定数で持ち、現行は `nlh` のみ。
**Reason**: まずは NL Hold'em のラベル差分だけで十分。

## R7: トーナメントの子データ

**Decision**: タグ、ブラインドレベル、チップ購入は別テーブルで管理する。
**Reason**: それぞれ更新頻度が異なるため、API も分けた方が扱いやすい。

## R8: フロントエンドの状態管理

**Decision**: Query は offlineFirst + persisted cache を使う。
**Reason**: 実装がすでにそうなっており、一覧・編集の体験が安定する。

## R9: ナビゲーション

**Decision**: 現行の主要ナビは `Sessions / Stores / Players / Settings`。
**Reason**: `Currencies` は独立ルートとして存在するが、主要ナビには含まれていない。
