import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { sessionToSessionTag } from "../schema/session-tag";

describe("SessionToSessionTag — indexes", () => {
	const config = getTableConfig(sessionToSessionTag);

	it("has sessionToSessionTag_sessionTagId_idx for reverse tag lookups", () => {
		const idx = config.indexes.find(
			(i) => i.config.name === "sessionToSessionTag_sessionTagId_idx"
		);
		expect(idx?.config.columns.map((column) => column.name)).toEqual([
			"session_tag_id",
		]);
	});
});
