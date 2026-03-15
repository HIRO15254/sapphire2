# Requirements Checklist: 001-mobile-shell

**Iteration**: 1 (Revision 2)
**Date**: 2026-03-12

## Checklist

- [x] 実装詳細（言語、フレームワーク、API）が含まれていない
  - React、Tailwind、TanStack Router等の技術名は一切記載していない（shadcn/uiはデザインテーマの参照としてのみ言及）
- [x] ユーザー価値とビジネスニーズにフォーカスしている
  - 全要件・ストーリーはユーザーがナビゲーション（ボトム/サイド）を通じて得る体験に焦点を当てている
- [x] 全必須セクション完了
  - User Scenarios & Testing、Requirements、Success Criteria 全て記載済み
- [x] 要件がテスト可能かつ明確
  - 全 FR-### は「〜しなければならない」形式で明確な検証基準を持つ
- [x] Success Criteria が測定可能かつ技術非依存
  - ピクセル数・操作回数・状態一致・視覚的一貫性等、技術を問わず検証可能な指標を定義
- [x] Acceptance Scenarios が定義済み
  - 全5ユーザーストーリーに Given/When/Then 形式のシナリオを記載
- [x] Edge Cases が特定済み
  - タブレット境界、遷移遅延、ブラウザ戻る、ラベル長、横向き、デバッグツールサイズ、旧URL、サイド/ボトム項目差異、リサイズ切替の9ケースを定義
- [x] スコープが明確に限定
  - Out of Scope セクションに5項目を明記

## Ambiguity Scan Results

| Category | Status | Notes |
|----------|--------|-------|
| Functional Scope & Behavior | Clear | ボトムナビ（5アイコン等間隔・下部固定）、サイドナビ（左側固定）、ヘッダー削除、デバッグツール非干渉が明確 |
| Domain & Data Model | Clear | Navigation Item・Mobile Shell・Desktop Shell エンティティ定義済み |
| Interaction & UX Flow | Clear | タップ/クリック→遷移フロー明確。全機能アクセス統合を明記 |
| Non-Functional Quality | Partial | レスポンス速度は定性的（SC-006）。数値SLAは Out of Scope として解消 |
| Integration & External Dependencies | Clear | Tabler Icons 依存を FR-004 で明記。デバッグツール非干渉を FR-014 で明記 |
| Edge Cases & Failure Handling | Clear | 9ケースを Edge Cases セクションに定義 |
| Constraints & Tradeoffs | Clear | タブレット扱い・デバッグツール対応方針・サイドナビ折りたたみ除外等を Assumptions/Out of Scope に記録 |
| Terminology & Consistency | Clear | 「ボトムナビゲーション」「サイドナビゲーション」「アクティブ状態」「デザインテーマ」で統一 |
| Completion Signals | Clear | SC-001〜012 で測定可能な完了条件を定義 |
| Placeholders / Vague language | Clear | テンプレートプレースホルダーは全て置換済み |

## Revision Changes Summary

差し戻し理由（「サイドナビゲーションに関しても要件です」）に基づく修正内容:
1. **サイドナビゲーション追加**: User Story 2を新規追加（デスクトップ画面でサイドナビゲーション表示）
2. **FR-015〜FR-018追加**: サイドナビゲーションの表示・構成・固定配置・モバイル非表示の要件
3. **SC-003/SC-004追加**: サイドナビゲーション表示・非表示の成功基準
4. **Desktop Shell エンティティ追加**: Key Entities にデスクトップシェルコンテナを追加
5. **ヘッダー削除をモバイル・デスクトップ両方に拡張**: FR-010、SC-009を更新
6. **User Story 3（旧User Story 2）をボトム/サイド統合に改訂**: ヘッダー削除後の機能統合をボトム・サイド両方に適用
7. **Edge Cases 追加**: サイド/ボトム項目差異、リサイズ切替の2ケースを追加
8. **Out of Scope更新**: 「デスクトップ向けナビゲーションの変更・再設計」を除去（スコープ内になったため）、サイドナビ折りたたみ機能を追加
9. **前回フィードバック保持**: 等間隔配置、デバッグ表示非干渉、shadcn/uiテーマ一貫性、ヘッダーナビ削除、全機能アクセスの全項目を維持

## Result

**PASS** - 全チェック項目が合格。イテレーション1で完了。
