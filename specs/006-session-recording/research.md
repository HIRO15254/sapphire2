# Research: リアルタイムセッション記録

**Branch**: `006-session-recording` | **Date**: 2026-03-30

## R-001: LiveSessionとpokerSessionの共存パターン

**Decision**: LiveSessionを新規テーブルとして作成し、pokerSessionに`liveSessionId`カラムを追加して参照する。LiveSession完了時にpokerSessionレコードを生成し、既存の分析・フィルタ機能はpokerSession経由で動作を維持。

**Rationale**: 既存のpokerSessionテーブルとそのクエリロジック（P&L計算、フィルタリング、ページネーション）は成熟しており、変更リスクが高い。LiveSessionを独立テーブルとして追加し、pokerSessionからオプショナル参照を持つことで、既存機能への影響を最小化できる。

**Alternatives considered**:
- pokerSessionテーブル自体に状態カラムを追加する → 既存のクエリロジックへの影響が大きく、完了済みセッションの分析ロジックに副作用が発生するリスク
- LiveSessionテーブルのみで管理し、pokerSessionを廃止 → 既存機能の大規模リファクタリングが必要

## R-002: イベントデータ構造（多種のイベントタイプ）

**Decision**: SessionEventテーブルは共通カラム（id, liveSessionId, eventType, occurredAt, createdAt, updatedAt）に加え、イベント固有データをJSON text型の`payload`カラムに格納する。イベントタイプごとにZodスキーマでpayloadをバリデーションする。

**Rationale**: Cloudflare D1（SQLite）ではJSONカラムのサポートが限定的だが、text型でJSON文字列を格納しアプリケーション層でパース・バリデーションするパターンはSQLiteでは一般的。イベントタイプごとに個別テーブルを作るとテーブル数が膨大になり、新イベントタイプ追加のたびにマイグレーションが必要になる。

**Alternatives considered**:
- イベントタイプごとに専用テーブル → テーブル数の爆発、JOIN複雑化
- 共通カラムを多数定義してnullableにする → スパースなテーブルになり、バリデーションが困難

## R-003: スタック記録の付随情報（オールイン、アドオン、リバイ）

**Decision**: 付随情報はSessionEventのpayloadに含める。スタック記録イベントのpayloadに`allIns`（配列）、`addon`、`rebuy`フィールドをオプショナルで持たせる。

**Rationale**: スタック記録と付随情報は概念的に1:Nの関係（特にオールインは複数）だが、独立したイベントとして扱うとスタック記録との紐づけが複雑になる。JSONペイロード内に配列として格納すれば、1回のクエリで全情報を取得でき、UIでの表示も容易。

**Alternatives considered**:
- 付随情報を別テーブルで管理 → JOINが増え、1回のスタック記録に対する操作が複雑化
- 付随情報を独立イベントとして記録 → スタック記録との親子関係の管理が煩雑

## R-004: 同卓プレイヤーの管理方式

**Decision**: SessionTablePlayerテーブルで現在の同卓状態を管理し、参加・退席はSessionEventとしても記録する。SessionTablePlayerはliveSessionIdとplayerIdの組み合わせで一意とし、isActive（現在同卓中か）フラグを持つ。

**Rationale**: 「現在の同卓者リスト」を高速に取得するにはステートテーブルが必要。イベントのみから同卓者を算出するには全イベントをスキャンする必要があり、パフォーマンスが悪い。イベント（履歴）とステート（現在値）の二重管理になるが、同卓者数は限定的（テーブルサイズ上限10程度）なので複雑さは許容範囲。

**Alternatives considered**:
- イベントのみで管理し、毎回集約で現在の同卓者を算出 → イベント数が多い場合にパフォーマンス懸念
- プレイヤー参加/退席をイベントとしてのみ記録 → 「今誰がいるか」の取得が非効率

## R-005: P&L再計算のトリガー

**Decision**: 完了済みセッションのイベント編集・削除時に、イベントの集約からP&L関連値を再算出し、対応するpokerSessionレコードと通貨トランザクションを更新する。再計算ロジックはサービス関数として切り出し、セッション完了時と編集時の両方から呼び出す。

**Rationale**: 再計算が必要なタイミングは「セッション完了時」と「完了済みセッションのイベント編集時」の2箇所。共通のサービス関数に集約することで、計算ロジックの一貫性を保証する。

**Alternatives considered**:
- pokerSessionの値を手動で更新させる → ユーザー体験が悪く、データ不整合のリスク
- イベント変更時にpokerSessionを削除して再作成 → 通貨トランザクションの再作成が複雑

## R-006: 既存pokerSession直接入力との共存

**Decision**: pokerSessionテーブルに`liveSessionId`（nullable）を追加。直接入力で作成されたpokerSessionはliveSessionIdがnull、LiveSession経由で作成されたものはliveSessionIdが設定される。既存のセッション一覧・分析画面ではliveSessionIdの有無でイベント履歴リンクの表示を切り替える。

**Rationale**: 既存の直接入力フローは「過去のセッションをまとめて入力する」ユースケースで有用であり、廃止する理由がない。nullable外部キーにより後方互換性を完全に維持できる。

**Alternatives considered**:
- 直接入力を廃止しすべてLiveSession経由に統一 → 過去データの一括入力が不便になる
- 別テーブルで管理 → 分析時のクエリが複雑化
