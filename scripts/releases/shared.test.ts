import { describe, expect, it } from "vitest";
import {
	bumpVersion,
	createSummary,
	dedupeEntries,
	getHighestReleaseType,
} from "./shared";

describe("release helpers", () => {
	it("bumps by the most severe entry", () => {
		expect(
			bumpVersion("1.2.3", [
				{
					title: "Internal cleanup",
					summary: "Refactor release scripts.",
					changes: { type: "fix", scope: "developer" },
				},
				{
					title: "New settings flow",
					summary: "Add configurable update notes entry point.",
					changes: { type: "minor", scope: "user" },
				},
			])
		).toBe("1.3.0");
	});

	it("dedupes repeated entries", () => {
		const entry = {
			title: "Tag editor",
			summary: "Allow editing tags.",
			changes: { type: "minor" as const, scope: "user" as const },
		};

		expect(dedupeEntries([entry, entry])).toEqual([entry]);
	});

	it("groups summary data and tracks major releases", () => {
		const summary = createSummary("2.0.0", [
			{
				title: "Breaking auth update",
				summary: "Rotate token storage.",
				changes: { type: "major", scope: "developer" },
			},
		]);

		expect(getHighestReleaseType(summary.entries)).toBe("major");
		expect(summary.nextVersion).toBe("3.0.0");
		expect(summary.changes.developer).toHaveLength(1);
		expect(summary.changes.user).toHaveLength(0);
	});
});
