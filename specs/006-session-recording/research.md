# Research: リアルタイムセッション記録

**Branch**: `006-session-recording` | **Date**: 2026-03-30

## R-001: キャッシュゲーム/トーナメントの分離とpokerSessionとの共存

**Decision**: キャッシュゲームとトーナメントのライブセッションを別テーブル（`liveCashGameSession`, `liveTournamentSession`）で管理する。pokerSessionに`liveCashGameSessionId`と`liveTournamentSessionId`（両方nullable）を追加して参照する。完了時にpokerSessionレコードを生成し、既存の分析・フィルタ機能はpokerSession経由で動作を維持。

**Rationale**: キャッシュゲームとトーナメントのセッション記録は構造が大きく異なる（キャッシュゲーム: バイイン/キャッシュアウト/オールインEV、トーナメント: 残り人数/アベレージスタック/リバイ/アドオン/順位）。既存のringGame/tournamentが別テーブルであるパターンとも一致する。単一テーブルにすると多数のnullableカラムが発生し、型安全性が低下する。

**Alternatives considered**:
- 単一のliveSessionテーブルにtype discriminatorで管理 → nullable カラムが多数発生、バリデーションが複雑化
- pokerSessionテーブル自体に状態カラムを追加する → 既存のクエリロジックへの影響が大きい
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

## R-007: オールイン記録形式の変更（勝率ベースEV計算）

**Decision**: オールインの記録形式を`{ actualResult, evResult }`から`{ potSize, trials, equity, wins }`に変更する。EV計算は勝率ベースで行う: `evAmount = potSize × (equity / 100) × trials`、`actualAmount = potSize × wins`。winsは小数を許容する（chop対応: 例えば2回中1勝1chop → wins=1.5）。

**Rationale**: ポーカーにおけるオールイン時の情報として、プレイヤーが把握しているのは「ポットサイズ」「自分のエクイティ」「Run it multi timesの試行回数」「何回勝ったか」であり、actualResult/evResultの差額よりも直感的に入力できる。また、Run it multi timesに対応するにはtrialsフィールドが必須。chopは両者の合意で分割するケースで、0.5勝分として計上する。

**Alternatives considered**:
- actualResult/evResult維持 → Run it multi timesの表現が困難、入力が直感的でない
- potSize/trialsのみでEV計算しない → EV追跡がライブセッション記録の重要な価値

## R-008: セッションライフサイクルの変更（paused廃止、reopen導入）

**Decision**: セッション状態を「active」「completed」の2状態のみとする。「paused（中断中）」は廃止。完了済みセッションは「reopen」操作で再びactiveにでき、追加のイベントを記録可能。再度完了時にpokerSession/currencyTransactionを再計算する。同時にactiveにできるセッションは1つのみ。

**Rationale**: 実運用では「中断中」と「完了後に再開」の違いが曖昧であり、ユーザーは「席に戻ったら続きを記録したい」というシンプルなニーズを持つ。状態を2つに減らすことでUIとロジックがシンプルになる。同時進行を1セッションに制限することで、ボトムナビのコンテキスト切り替えが明確になる。

**Alternatives considered**:
- 3状態（active/paused/completed）維持 + reopen追加 → 4つの状態遷移が複雑
- 新規セッション作成で設定引継ぎ → 同一セッションの連続性が失われ、P&Lが分断される

## R-009: ボトムナビゲーションの動的切り替え

**Decision**: ボトムナビはライブセッションの状態に応じて2モードで動作する。**セッション進行中モード**: 中央の強調ボタンが現在のセッション画面への遷移、他のナビ項目はイベント履歴・同卓者等の補助画面。**通常モード**: 中央ボタンが新規セッション開始/完了セッション再始動、他は既存のナビ構成を維持。

**Rationale**: ライブセッション中はセッション記録がアプリの主要アクションであり、最もアクセスしやすい中央ボタンに配置するのが自然。セッション非進行中は通常のナビ構成を維持することで、既存機能へのアクセスを損なわない。

**Alternatives considered**:
- 常時固定のナビ項目にLiveを追加 → セッション進行中に他の画面への遷移が頻繁になり、記録に集中できない
- フローティングアクションボタン → ボトムナビとの競合、モバイルUI的に不整合

## R-010: 初回バイインのセッション開始時入力

**Decision**: キャッシュゲームセッション開始時にバイイン額を必須入力とする。リングゲーム設定のmaxBuyInが選択されている場合は初期値として自動入力。2回目以降のチップ追加はスタック記録のアドオンとして記録する（スタンドアロンのcash_game_buy_inイベントは廃止）。

**Rationale**: 実運用では初回バイインは必ずセッション開始時に行うため、別イベントにする意味がない。maxBuyIn自動入力によりワンタップでの開始が可能になる。2回目以降の追加チップはスタック記録と同時に行うのが自然（「スタックが減ったのでチップを追加した→現在のスタック」という流れ）。

**Alternatives considered**:
- バイインを常に独立イベントとして維持 → 初回の操作手順が増え、SC-001（30秒以内）を満たしにくい
- バイインをオプショナルにする → P&L計算に必須のため不可

## R-011: 1画面完結設計とボトムシート入力パターン

**Decision**: ライブセッション中の全画面はビューポート内にスクロールなしで収まる設計とする。オールインやアドオンの入力はボトムシート（ResponsiveDialogのDrawerモード）で行い、追加済みの記録はバッジとして表示する。バッジタップで編集・削除が可能。

**Rationale**: ライブセッション中はゲームの合間に素早く操作する必要があり、スクロールは操作の妨げになる。ボトムシートは主画面を離れずに入力でき、追加後はバッジとしてコンパクトに表示することで画面スペースを節約する。

**Alternatives considered**:
- スクロール可能なフォームで全項目を表示 → スクロールが必要になり1画面に収まらない
- 別ページに遷移して入力 → コンテキストが失われ、操作手順が増える
