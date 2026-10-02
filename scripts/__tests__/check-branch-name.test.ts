import { describe, expect, it } from "vitest";

import { isAcceptedBranchName } from "../check-branch-name";

describe("isAcceptedBranchName", () => {
	it.each([
		"feature/sa2-253",
		"release/v3.5.1",
		"HIRO15254/p6b",
		"claude/lucid-mendel-q7wfwp",
		"codex/normalize-game-mix-membership",
	])("accepts the ASCII branch %s", (name) => {
		expect(isAcceptedBranchName(name)).toBe(true);
	});

	it.each([
		"feature/sa2-253-p1-実装ループの設定（linear・リポジトリ・github・orca・エージェント）",
		"feature/sa2-228-p6a-ルート切替とナビゲーション導線の更新",
		"feature/has space",
		"-leading-dash",
	])("rejects %s, which claude-code-action refuses", (name) => {
		expect(isAcceptedBranchName(name)).toBe(false);
	});
});
