import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { playerToPlayerTag } from "../schema/player";

describe("PlayerToPlayerTag — indexes", () => {
	const config = getTableConfig(playerToPlayerTag);

	it("has playerToPlayerTag_playerTagId_idx for reverse tag lookups", () => {
		const idx = config.indexes.find(
			(i) => i.config.name === "playerToPlayerTag_playerTagId_idx"
		);
		expect(idx?.config.columns.map((column) => column.name)).toEqual([
			"player_tag_id",
		]);
	});
});
