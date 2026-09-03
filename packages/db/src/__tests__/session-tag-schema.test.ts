import { describe, expect, it } from "vitest";
import { sessionToSessionTag } from "../schema/session-tag";
import { indexesOf } from "./test-utils";

describe("SessionToSessionTag — indexes", () => {
	it("has sessionToSessionTag_sessionTagId_idx for reverse tag lookups", () => {
		expect(indexesOf(sessionToSessionTag)).toEqual(
			expect.arrayContaining([
				{
					columns: ["session_tag_id"],
					name: "sessionToSessionTag_sessionTagId_idx",
					unique: false,
					where: null,
				},
			])
		);
	});
});
