import { describe, expect, it } from "vitest";
import { playerToPlayerTag } from "../schema/player";
import { indexesOf } from "./test-utils";

describe("PlayerToPlayerTag — indexes", () => {
	it("has playerToPlayerTag_playerTagId_idx for reverse tag lookups", () => {
		expect(indexesOf(playerToPlayerTag)).toEqual(
			expect.arrayContaining([
				{
					columns: ["player_tag_id"],
					name: "playerToPlayerTag_playerTagId_idx",
					unique: false,
					where: null,
				},
			])
		);
	});
});
