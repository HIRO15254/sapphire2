---
name: create-update-notes
description: sapphire2 のアップデートノート（GitHub Release）を前回タグ以降のマージPRから起草し、Draft Release として登録する。ユーザーが「リリースノート作成」「アップデートノート」「新バージョン公開」などを求めたとき、または `/create-update-notes` を呼んだときに使用する。
---

## User Input

```text
$ARGUMENTS
```

`$ARGUMENTS` には新しいバージョン番号（例: `v1.4.0`）が入る想定。空なら最初のステップでユーザーに確認する。

## Goal

sapphire2 の過去リリース（v1.1.0 / v1.2.0 / v1.3.0）と同じトーン・構造のアップデートノートを作成し、`HIRO15254/sapphire2` に Draft Release として登録する。ユーザーに最終的な URL と Markdown 本文を返す。

## Fixed Structure

```markdown
## vX.Y.Z Release Notes

### New Features

- <ユーザー視点の一文> (#PR番号)

### UI Improvements

- <ユーザー視点の一文> (#PR番号)

### Bug Fixes

- Fixed <現象> (#PR番号)
```

- カテゴリに該当する項目が0件ならそのセクションごと削除する。
- 見出しは `##` / `###` を過去ノートと厳密に揃える。

## Style Rules

以下を必ず守る:

- **ユーザー視点で書く**: 実装用語（router, mutation, schema, middleware, component 名, テーブル名 など）を本文から除去し、画面・ワークフロー・操作で何が変わったかを書く。
- **1行1項目、末尾にピリオドを付けない**（過去ノートと揃える）。
- **時制**:
  - New Features / UI Improvements → 名詞句または過去分詞の受動形（"X support for Y" / "X redesigned with Y" / "X added to Z"）。
  - Bug Fixes → `Fixed` で開始（"Fixed X not working when Y"）。
- **末尾に PR 番号**: `(#123)` 形式。同じトピックをまとめた複数 PR は `(#123, #124)`。
- **英語で書く**: 過去ノートが英語のため統一する。
- **除外**: dependabot、バージョンバンプ自体の PR、pure refactor / test-only / docs-only / CI-only / 内部リネーム。ただしユーザー体験に影響がある UI リファクタは UI Improvements に含める。

### 良い例（v1.3.0 より1件ずつ抜粋）

```
- AI-powered tournament data extraction from tournament URLs and images (#154)
- Live session header redesigned with 3-column layout showing time, field/entries, and P&L/avg stack (#185, #190)
- Fixed HTML parsing errors in Cloudflare Workers (#154)
```

「再設計／刷新／layout 変更」は UI Improvements、新しい画面や機能の導入は New Features、壊れていたものの修正は Bug Fixes、が原則。迷ったら UI Improvements に寄せる（過去ノート傾向）。

## Execution Flow

### 1. バージョン番号の決定

1. `$ARGUMENTS` から `vX.Y.Z` 形式を抽出。形式不正または未指定なら「新しいバージョン番号は？（例: v1.4.0）」と1回だけユーザーに確認。
2. `mcp__github__get_latest_release` で `HIRO15254/sapphire2` の最新リリースを取得し、`PREV_TAG` とする。
3. 新バージョンが `PREV_TAG` より semver として前進しているか検証。同値・降順・同タグが既に存在する場合はユーザーに確認。

### 2. 対象 PR 範囲の決定

```bash
git fetch --tags origin
git log --first-parent "${PREV_TAG}..origin/main" --format='%s'
```

- 各行から正規表現 `#(\d+)` で PR 番号を抽出し、重複を除く。
- 1件も取れない場合は `git log "${PREV_TAG}..origin/main" --format='%s'` にフォールバック。
- マージコミット件名が `Merge pull request #NNN from ...` の場合と、squash merge 由来の `Title (#NNN)` の両方に対応できること。

### 3. PR 詳細の取得

抽出した各 PR について `mcp__github__pull_request_read`（`method: "get"`）で `title` / `body` / `labels` / `state` / `user.login` を取得する。独立な PR 取得は並列化してよい。

除外判定:

- `user.login` が `dependabot[bot]` / `renovate[bot]` など bot。
- `title` が `Release vX.Y.Z` / `chore(release): ...` などのバージョンバンプのみ。
- `labels` に `ignore-release-notes` 相当があれば除外（存在する場合）。
- body / title が pure refactor・test-only・docs-only・CI-only で、ユーザー体験に影響しないと判断できるもの。

### 4. 分類（LLM 推論）

以下のヒントを使って各 PR を New Features / UI Improvements / Bug Fixes に割り当てる。確信が持てないものは内部リストで `[要確認]` とマークしておく。

- `title` の conventional prefix: `feat:` → Features / `fix:` → Bug Fixes / `refactor:` `chore:` → 多くは除外。
- `labels`: `enhancement` → Features or UI、 `bug` → Bug Fixes、 `ui`/`design` → UI Improvements。
- body のキーワード: `redesign` / `layout` / `rework` / `UX` → UI Improvements、 `broken` / `regression` / `wasn't` → Bug Fixes、 `add` / `support for` / `new` → New Features。

### 5. 一行要約の作成

各 PR について、以下の手順で1行要約を作る:

1. `title` から conventional prefix（`feat:`, `fix:`, 等）とスコープ括弧を除去。
2. body の冒頭段落または Summary セクションから、ユーザーに見える挙動変化を抽出。
3. 実装用語を平易な UI 表現に置き換える（例: `trpc router` → 具体画面名、`mutation` → 該当アクション名）。
4. 末尾に `(#PR番号)` を付与。同一トピックの連番 PR は統合。
5. 60〜120 文字程度を目安。文末ピリオドは付けない。

### 6. レビュー提示

組み立てた Markdown をコードブロックで提示し、以下をまとめて1度にユーザーに確認する:

1. カテゴリ分類は妥当か（特に `[要確認]` とした項目）
2. 除外した PR で復活させるべきものはあるか（除外リストも併せて提示）
3. 文言修正の要否
4. バージョン番号・タグ名・タイトルの最終確認

ユーザーの修正指示を反映し、承認が出るまでこのステップを繰り返す（最大 3 往復）。

### 7. Draft Release の作成

承認後、GitHub API に直接投稿して Draft Release を作成する（MCP に `create_release` がないため）:

```bash
# 事前チェック
if [ -z "$GITHUB_TOKEN" ]; then
  echo "GITHUB_TOKEN is not set; skipping automated draft creation"
else
  curl -sS -X POST \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    https://api.github.com/repos/HIRO15254/sapphire2/releases \
    -d @/tmp/release-body.json
fi
```

`/tmp/release-body.json` は以下の構造で書き出す:

```json
{
  "tag_name": "vX.Y.Z",
  "target_commitish": "main",
  "name": "vX.Y.Z",
  "body": "...<完成した Markdown>...",
  "draft": true,
  "prerelease": false
}
```

- 成功時はレスポンスの `html_url` をユーザーに表示。
- `GITHUB_TOKEN` が未設定、または API が 4xx を返した場合は、以下の pre-filled URL を提示して手動作成を促す:
  - `https://github.com/HIRO15254/sapphire2/releases/new?tag=<vX.Y.Z>&title=<vX.Y.Z>&body=<urlencoded>`
- いずれの場合でも、最終 Markdown 本文は必ずユーザーに表示する。

## Output

最終的にユーザーに返すもの:

1. Draft Release の URL（自動作成成功時）または手動作成用 URL
2. 採用した Markdown 本文のフルテキスト
3. 除外した PR 番号の短いリスト（存在する場合）

## Notes

- 本 skill はリリースノート本文の起草のみを行い、`CHANGELOG.md` 更新・`package.json` version bump・タグ push は行わない。
- 本 skill からの自発的な `git push` や本番 Release の公開（`draft: false` での作成）は禁止。ユーザーが別途 Draft を Publish する。
- 過去ノートのフォーマット変更時は、本 skill の "Fixed Structure" と "良い例" を合わせて更新すること。
