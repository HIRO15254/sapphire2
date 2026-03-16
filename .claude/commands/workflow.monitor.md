---
description: GitHub Issueを監視し、PRレビュー方式でspeckitパイプラインを自動実行する
---

## 概要

GitHub Issueの `wf:*` ラベルを監視し、AIがボールを持っている状態のIssueに対してspeckitパイプラインの各ステージを自動実行する。
レビューはPR上で行い、PR review stateの変化を検知して次のステージに進む。

**呼び出し方法**:
- 手動: `/workflow.monitor`
- 定期実行: `/loop 5m /workflow.monitor`（3日間有効、セッション終了で停止）

## ワークフロー状態一覧

| ラベル | ボール | 次のアクション |
|--------|--------|----------------|
| `wf:needs-spec` | AI | 仕様書を作成して `wf:spec-review` へ |
| `wf:spec-review` | 人間 | PR上でレビュー待ち |
| `wf:needs-plan` | AI | 実装計画を作成して `wf:plan-review` へ |
| `wf:plan-review` | 人間 | PR上でレビュー待ち |
| `wf:implementing` | AI | 実装して `wf:impl-review` へ |
| `wf:impl-review` | 人間 | PR上で最終レビュー待ち |
| `wf:done` | — | 完了 |
| `wf:blocked` | — | 手動解決待ち |

---

## 実行フロー

### Step 1: 処理対象のIssueを探す

#### 1a: AIボールのIssueを取得

```bash
gh issue list --label "wf:needs-spec" --json number,title,body,labels --limit 50
gh issue list --label "wf:needs-plan" --json number,title,body,labels --limit 50
gh issue list --label "wf:implementing" --json number,title,body,labels --limit 50
```

#### 1b: レビュー待ちIssueのレビュー状態を確認

```bash
gh issue list --label "wf:spec-review" --json number,title,labels --limit 50
gh issue list --label "wf:plan-review" --json number,title,labels --limit 50
gh issue list --label "wf:impl-review" --json number,title,labels --limit 50
```

レビュー待ちIssueがある場合、紐づくPRのレビュー状態を確認（Step 2へ）。

#### 1c: 優先度判定

- 結果が全て空なら「処理対象のIssueはありません」と報告して終了
- 複数ある場合は、最もnumber（Issue番号）が小さいものを1つ選択
- 優先度: レビュー完了の検知 > `wf:needs-spec` > `wf:needs-plan` > `wf:implementing`

---

### Step 2: レビュー完了の検知

レビュー待ち（`wf:spec-review` / `wf:plan-review` / `wf:impl-review`）のIssueに対して:

1. **Issueコメント履歴からブランチ名を特定**
   - Issueに紐づくPRコメントから `**ブランチ**: \`` パターンで既存ブランチ名を検索
   - または Issue のリンクされたPRを取得

2. **PRを特定**
   ```bash
   gh pr list --state open --json number,headRefName,reviews,latestReviews --limit 100
   ```
   ブランチ名でフィルタしてPRを見つける。

3. **最新レビュー状態を判定**
   ```bash
   gh pr view {PR_NUMBER} --json latestReviews
   ```

   - **APPROVED** → 次ステージへ遷移（Step 2a）
   - **CHANGES_REQUESTED** → 差し戻し判定（Step 2b）
   - **レビューなし / COMMENTED のみ** → スキップ（次回ポーリングで再確認）

#### Step 2a: Approve処理

| 現在のラベル | 遷移先 | 追加アクション |
|-------------|--------|---------------|
| `wf:spec-review` | `wf:needs-plan` | — |
| `wf:plan-review` | `wf:implementing` | — |
| `wf:impl-review` | `wf:done` | Issueをクローズ |

```bash
gh issue edit {NUMBER} --remove-label "{FROM}" --add-label "{TO}"
```

`wf:impl-review` → `wf:done` の場合:
```bash
gh issue edit {NUMBER} --remove-label "wf:impl-review" --add-label "wf:done"
gh issue close {NUMBER}
```
PRのマージは人間が行う（auto-mergeは設定しない）。

#### Step 2b: 差し戻し判定

PR review commentsの内容を取得:
```bash
gh api repos/{OWNER}/{REPO}/pulls/{PR_NUMBER}/reviews --jq '.[] | select(.state == "CHANGES_REQUESTED") | .body'
```

コメント内容を解析し、影響範囲が最も手前のステージに差し戻す:

| 言及内容 | 差し戻し先 | キーワード例 |
|---------|-----------|-------------|
| 仕様の問題 | `wf:needs-spec` | 要件、スコープ、ストーリー、ユースケース、仕様、spec |
| 計画の問題 | `wf:needs-plan` | 設計、タスク分割、アーキテクチャ、計画、plan |
| 実装の問題 | `wf:implementing` | バグ、コード、テスト、実装、fix、修正 |

**判定ルール**:
- 複数の影響範囲に言及がある場合は、最も手前のステージに戻す
- 判定が曖昧な場合は、現在のステージの1つ前に戻す
  - `wf:spec-review` → `wf:needs-spec`
  - `wf:plan-review` → `wf:needs-plan`
  - `wf:impl-review` → `wf:implementing`

```bash
gh issue edit {NUMBER} --remove-label "{FROM}" --add-label "{TO}"
```

---

### Step 3: ステージ別アクション

---

## State: `wf:needs-spec` → 仕様書作成（spec-writer エージェントに委譲）

### 目的
Issue本文の自然言語要件から、spec-writer エージェントを起動して仕様書作成を委譲する。

### 実行手順

1. **Issue情報を収集**
   ```bash
   gh issue view {NUMBER} --json number,title,body,labels,comments
   ```
   - Issue本文（body）、タイトル、番号を取得
   - 差し戻しの場合: 最新の CHANGES_REQUESTED レビューコメントから修正理由を抽出
   - 差し戻しの場合: Issueコメント履歴から `**ブランチ**: \`` パターンで既存ブランチ名を特定

2. **MODE判定**
   - PRが既に存在する = `revision`（差し戻し後の再実行）
   - PRが存在しない = `new`（初回実行）

3. **spec-writer エージェントを起動**

   Agent tool で `.claude/agents/spec-writer.md` を `subagent_type: "spec-writer"` で spawn する。

   **新規の場合のprompt**:
   ```
   以下のGitHub Issueの仕様書を作成してください。
   `.claude/agents/spec-writer.md` を読み、Execution Protocol に従って全ステップを実行してください。

   ISSUE_NUMBER: {NUMBER}
   ISSUE_TITLE: {TITLE}
   ISSUE_BODY:
   {BODY}

   MODE: new
   ```

   **差し戻しの場合のprompt**:
   ```
   以下のGitHub Issueの仕様書を修正してください。
   `.claude/agents/spec-writer.md` を読み、Execution Protocol に従って全ステップを実行してください。

   ISSUE_NUMBER: {NUMBER}
   ISSUE_TITLE: {TITLE}
   ISSUE_BODY:
   {BODY}

   MODE: revision
   REJECTION_REASON:
   {PRレビューのCHANGES_REQUESTEDコメントから抽出した修正理由}

   EXISTING_BRANCH: {既存ブランチ名}
   ```

4. **エラーハンドリング（monitor側フォールバック）**
   - エージェント完了後、ラベルが `wf:spec-review` に遷移していることを確認
   - 遷移していない場合（エージェント内でエラー発生）:
     ```bash
     gh issue comment {NUMBER} --body "## ⚠️ 仕様書作成でエラーが発生しました

     手動での対応が必要です。"
     gh issue edit {NUMBER} --remove-label "wf:needs-spec" --add-label "wf:blocked"
     ```

---

## State: `wf:needs-plan` → 実装計画・タスク作成（plan-writer エージェントに委譲）

### 目的
承認済みの仕様書から、plan-writer エージェントを起動して計画作成を委譲する。

### 実行手順

1. **Issue情報を収集**
   ```bash
   gh issue view {NUMBER} --json number,title,body,labels,comments
   ```
   - PRからBRANCH_NAMEを特定
   - 差し戻しの場合: PRの最新 CHANGES_REQUESTED レビューから修正理由を抽出

2. **MODE判定**
   - PRコメントに「実装計画が完成しました」が含まれる = `revision`
   - 含まれない = `new`

3. **plan-writer エージェントを起動**

   Agent tool で `.claude/agents/plan-writer.md` を `subagent_type: "plan-writer"` で spawn する。

   **prompt**:
   ```
   以下のGitHub Issueの実装計画を{MODE == new ? '作成' : '修正'}してください。
   `.claude/agents/plan-writer.md` を読み、Execution Protocol に従って全ステップを実行してください。

   ISSUE_NUMBER: {NUMBER}
   ISSUE_TITLE: {TITLE}
   BRANCH_NAME: {BRANCH_NAME}
   MODE: {MODE}
   {MODE == revision ? 'REJECTION_REASON:\n{修正理由}' : ''}
   ```

4. **エラーハンドリング（monitor側フォールバック）**
   - エージェント完了後、ラベルが `wf:plan-review` に遷移していることを確認
   - 遷移していない場合:
     ```bash
     gh issue comment {NUMBER} --body "## ⚠️ 計画作成でエラーが発生しました

     手動での対応が必要です。"
     gh issue edit {NUMBER} --remove-label "wf:needs-plan" --add-label "wf:blocked"
     ```

---

## State: `wf:implementing` → 実装（implementer エージェントに委譲）

### 目的
承認済みのタスク一覧に基づいて、implementer エージェントを起動して実装を委譲する。

### 実行手順

1. **Issue情報を収集**
   ```bash
   gh issue view {NUMBER} --json number,title,body,labels,comments
   ```
   - PRからBRANCH_NAMEを特定
   - 差し戻しの場合: PRの最新 CHANGES_REQUESTED レビューから修正理由を抽出

2. **MODE判定**
   - PRコメントに「実装が完了しました」が含まれる = `revision`
   - 含まれない = `new`

3. **implementer エージェントを起動**

   Agent tool で `.claude/agents/implementer.md` を `subagent_type: "implementer"` で spawn する。

   **prompt**:
   ```
   以下のGitHub Issueを{MODE == new ? '実装' : '修正'}してください。
   `.claude/agents/implementer.md` を読み、Execution Protocol に従って全ステップを実行してください。

   ISSUE_NUMBER: {NUMBER}
   ISSUE_TITLE: {TITLE}
   BRANCH_NAME: {BRANCH_NAME}
   MODE: {MODE}
   {MODE == revision ? 'REJECTION_REASON:\n{修正理由}' : ''}
   ```

4. **エラーハンドリング（monitor側フォールバック）**
   - エージェント完了後、ラベルが `wf:impl-review` に遷移していることを確認
   - 遷移していない場合:
     ```bash
     gh issue comment {NUMBER} --body "## ⚠️ 実装でエラーが発生しました

     手動での対応が必要です。"
     gh issue edit {NUMBER} --remove-label "wf:implementing" --add-label "wf:blocked"
     ```

---

## 差し戻し処理の共通ルール

差し戻し（CHANGES_REQUESTED）が発生した場合:

1. **差し戻し理由の取得**: PRの最新 CHANGES_REQUESTED レビューからコメントを抽出
2. **Delta修正**: 既存の成果物を全面書き直しせず、差し戻し理由に基づいて該当箇所のみ更新
3. **履歴保持**: 以前のPRコメント（仕様書・計画）は残したまま、新しいバージョンを追加投稿
4. **ブランチ再利用**: 既存のfeature branchを引き続き使用

## エラーハンドリング

- **Script失敗**: エラー内容をIssueコメントに投稿、`wf:blocked` に遷移
- **テスト失敗**: 最大3回修正を試行、それでも失敗なら `wf:blocked` に遷移
- **Git競合**: マージ競合が発生したらIssueコメントで報告、`wf:blocked` に遷移

## 注意事項

- 1回のmonitor実行で処理するIssueは**1つのみ**（他は次回ポーリングで処理）
- `wf:needs-spec` は `.claude/agents/spec-writer.md` エージェントに委譲（他ステージは将来エージェント化予定）
- Git操作は常に feature branch 上で行い、master を直接変更しない
- レビューはPR上で行い、Issueコメントコマンドは使用しない

## 後処理

各イテレーションの最後に `/clear` を実行してコンテキストを完全にリセットする。
monitor はステートレス（毎回 GitHub から状態を取得）なので、コンテキストの引き継ぎは不要。
