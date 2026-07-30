/**
 * AI 機能で使うモデル ID の唯一の置き場所。新しいモデルが出たら
 * `LATEST_MODEL` を書き換えるだけで全機能が追従する。
 * `scripts/check-rules.ts` がこのファイル以外での `claude-*` リテラルを禁止する。
 *
 * 実行時に Models API から「最新」を解決しない理由: モデル更新は破壊的な
 * API 変更を伴う（Opus 5 で thinking がデフォルト ON、Opus 4.7 で
 * `temperature` / `budget_tokens` 削除、Sonnet 5 でトークナイザ変更）。
 * 日付順の自動選択は単価やティアの違うモデル（preview 系、Haiku 系）にも
 * 黙って乗り換わるため、更新は人間のレビューを通す。
 */
export const LATEST_MODEL = "claude-opus-5";

/**
 * 機能ごとのモデル。`satisfies` により、`LATEST_MODEL` 以外の ID を
 * 割り当てると型エラーになる。
 */
export const AI_MODELS = {
	/** シーティング（スクリーンショットからの着席者読み取り）。 */
	seating: LATEST_MODEL,
	/** トーナメント情報の抽出。 */
	tournamentExtraction: LATEST_MODEL,
} as const satisfies Record<string, typeof LATEST_MODEL>;

/**
 * 抽出系リクエストの出力上限。`max_tokens` は thinking と応答テキストの
 * 合計に対する上限で、Opus 5 以降 thinking はデフォルト ON。出力サイズ
 * ぎりぎりに設定すると thinking が食い潰して構造化出力が途中で切れるため、
 * 実際の出力より十分大きく取る（生成された分しか課金されない）。
 */
export const EXTRACTION_MAX_TOKENS = 8192;
