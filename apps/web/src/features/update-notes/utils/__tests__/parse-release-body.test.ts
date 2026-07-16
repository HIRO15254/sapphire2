import { describe, expect, it } from "vitest";
import { parseReleaseBody } from "../parse-release-body";

describe("parseReleaseBody", () => {
	it("returns an empty array for null body", () => {
		expect(parseReleaseBody(null)).toEqual([]);
	});

	it("returns an empty array for an empty string body", () => {
		expect(parseReleaseBody("")).toEqual([]);
	});

	it("returns a section with no items when a heading has no bullets", () => {
		expect(
			parseReleaseBody("## v1.0.0 Release Notes\n\n### New Features\n")
		).toEqual([{ section: "New Features", items: [] }]);
	});

	it("groups bullets under their ### heading", () => {
		const body = [
			"## v1.4.0 Release Notes",
			"",
			"### New Features",
			"",
			"- Players can now seat themselves (#154)",
			"",
			"### Bug Fixes",
			"",
			"- Fixed HTML parsing errors (#154)",
		].join("\n");

		expect(parseReleaseBody(body)).toEqual([
			{
				section: "New Features",
				items: ["Players can now seat themselves (#154)"],
			},
			{
				section: "Bug Fixes",
				items: ["Fixed HTML parsing errors (#154)"],
			},
		]);
	});

	it("supports both - and * list markers within the same section", () => {
		const body = ["### UI Improvements", "- Dash item", "* Star item"].join(
			"\n"
		);

		expect(parseReleaseBody(body)).toEqual([
			{ section: "UI Improvements", items: ["Dash item", "Star item"] },
		]);
	});

	it("drops the top-level ## title without starting a section", () => {
		const body = [
			"## v1.4.0 Release Notes",
			"- orphan bullet before any ### heading",
		].join("\n");

		expect(parseReleaseBody(body)).toEqual([
			{ section: "", items: ["orphan bullet before any ### heading"] },
		]);
	});

	it("skips blank lines between bullets within a section", () => {
		const body = ["### New Features", "- first", "", "- second"].join("\n");

		expect(parseReleaseBody(body)).toEqual([
			{ section: "New Features", items: ["first", "second"] },
		]);
	});

	it("starts a new section list even when a later ### heading has no items", () => {
		const body = [
			"### New Features",
			"- only item",
			"### UI Improvements",
		].join("\n");

		expect(parseReleaseBody(body)).toEqual([
			{ section: "New Features", items: ["only item"] },
			{ section: "UI Improvements", items: [] },
		]);
	});
});
