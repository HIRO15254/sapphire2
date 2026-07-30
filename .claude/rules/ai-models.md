---
paths:
  - "packages/api/**"
  - "apps/web/**"
  - "apps/server/**"
---

# Claude Model Selection

Why this file exists: モデル ID がインラインリテラルで各所に散ると、機能ごとに世代がずれる。実際に `extractTablePlayers` を Opus 5 に上げた時点で `extractTournamentData` が Opus 4.8 に取り残された（PR #572）。方針は「**全 AI 機能が常に同じ最新モデルを使う**」。

## モデル ID は `packages/api/src/ai/models.ts` にしか書かない

- 新しいモデルが出たら [`LATEST_MODEL`](../../packages/api/src/ai/models.ts) を書き換える。それだけで全機能が追従する。
- 呼び出し側は `AI_MODELS.<機能名>` を使う。新しい AI 機能を足すときは `AI_MODELS` にキーを 1 つ増やす。`satisfies Record<string, typeof LATEST_MODEL>` により、古いモデル ID を割り当てると **型エラー**になる。
- `scripts/check-rules.ts` が `models.ts` 以外での `claude-*` リテラルを禁止する（Anthropic SDK の `Model` 型は `string & {}` を含む緩いユニオンなので、型チェックだけではタイポも旧モデルの直書きも検出できない）。

## 実行時に「最新」を自動解決しない

Models API を引いて日付順で最新を選ぶ方式は採らない。モデル更新は破壊的 API 変更を伴うため、人間のレビューを通す:

- Opus 5 で thinking がデフォルト ON（`thinking` 未指定でも thinking が走る）
- Opus 4.7 で `temperature` / `top_p` / `top_k` / `budget_tokens` が削除（送ると 400）
- Opus 4.7 でトークナイザが変わり、それ以前のモデルと比べて同じ入力が約 1.3 倍のトークンになった（Opus 4.8 / Opus 5 / Sonnet 5 / Fable 5 はこの新トークナイザ。世代を跨がない更新ではトークン数の見積りは変わらない）

日付順の自動選択は、単価やティアの違うモデル（preview 系、Haiku 系、$10/$50 の Fable 系）にも黙って乗り換わる。

## `max_tokens` は thinking の分を含めて取る

`max_tokens` は thinking と応答テキストの**合計**に対する上限で、Opus 5 以降 thinking はデフォルト ON。出力サイズぎりぎりに設定すると thinking が食い潰し、構造化出力が途中で切れて `parsed_output` が null になる（= `AI did not return structured data` で失敗）。抽出系は [`EXTRACTION_MAX_TOKENS`](../../packages/api/src/ai/models.ts) を使う。生成された分しか課金されないので、余裕を持たせてもコストは増えない。

## モデルを上げるときのチェックリスト

1. 対象モデルの破壊的変更を確認する。Claude Code なら `/claude-api migrate`、それ以外は公式の移行ガイド <https://platform.claude.com/docs/en/about-claude/models/migration-guide> を読む。
2. `thinking` / `effort` / サンプリングパラメータの扱いが変わっていないか、既存の呼び出しを確認する。
3. `max_tokens` に thinking の余地があるか確認する。
4. プロンプトの挙動変化（冗長さ、ツール呼び出し頻度）を実機で確認する。プロンプト文言はテストで固定しない（実装詳細なので、調整のたびにテストを直す手間だけが残る）。
