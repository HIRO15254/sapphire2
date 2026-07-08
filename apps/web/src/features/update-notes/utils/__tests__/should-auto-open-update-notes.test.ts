import { describe, expect, it } from "vitest";
import { shouldAutoOpenUpdateNotes } from "@/features/update-notes/utils/should-auto-open-update-notes";

describe("shouldAutoOpenUpdateNotes", () => {
	describe("when there is no latest release", () => {
		it("returns false when latestVersion is null (no releases published)", () => {
			expect(
				shouldAutoOpenUpdateNotes({
					latestVersion: null,
					viewedVersions: [],
				})
			).toBe(false);
		});

		it("returns false when latestVersion is null even if the list is still loading", () => {
			expect(
				shouldAutoOpenUpdateNotes({
					latestVersion: null,
					viewedVersions: undefined,
				})
			).toBe(false);
		});

		it("returns false when latestVersion is an empty string", () => {
			expect(
				shouldAutoOpenUpdateNotes({
					latestVersion: "",
					viewedVersions: [],
				})
			).toBe(false);
		});
	});

	describe("while the viewed list is still loading", () => {
		it("returns false when viewedVersions is undefined (avoids flashing open before data arrives)", () => {
			expect(
				shouldAutoOpenUpdateNotes({
					latestVersion: "v3.2.2",
					viewedVersions: undefined,
				})
			).toBe(false);
		});
	});

	describe("once the viewed list has loaded", () => {
		it("returns true when the user has no view records at all (first-ever load with a release)", () => {
			expect(
				shouldAutoOpenUpdateNotes({
					latestVersion: "v3.2.2",
					viewedVersions: [],
				})
			).toBe(true);
		});

		it("returns true when the user has viewed older versions but not the latest", () => {
			expect(
				shouldAutoOpenUpdateNotes({
					latestVersion: "v3.2.2",
					viewedVersions: ["v3.2.1", "v3.2.0"],
				})
			).toBe(true);
		});

		it("returns false when the user has already viewed the latest version", () => {
			expect(
				shouldAutoOpenUpdateNotes({
					latestVersion: "v3.2.2",
					viewedVersions: ["v3.2.2"],
				})
			).toBe(false);
		});

		it("returns false when the latest is viewed alongside other versions", () => {
			expect(
				shouldAutoOpenUpdateNotes({
					latestVersion: "v3.2.2",
					viewedVersions: ["v3.2.0", "v3.2.2", "v3.2.1"],
				})
			).toBe(false);
		});

		it("matches versions exactly (a differing case is treated as unviewed)", () => {
			expect(
				shouldAutoOpenUpdateNotes({
					latestVersion: "v3.2.2",
					viewedVersions: ["V3.2.2"],
				})
			).toBe(true);
		});

		it("does not treat a prefix match as a view (v3.2 is not v3.2.2)", () => {
			expect(
				shouldAutoOpenUpdateNotes({
					latestVersion: "v3.2.2",
					viewedVersions: ["v3.2"],
				})
			).toBe(true);
		});
	});
});
