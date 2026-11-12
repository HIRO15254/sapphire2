import { ICON_NAMES } from "virtual:tabler-icons/glyphs";
import { ICON_TAGS } from "virtual:tabler-icons/tags";
import { describe, expect, it } from "vitest";
import {
	buildIconSearchIndex,
	searchIcons,
	suggestIconFromWords,
} from "../icon-search";

const index = buildIconSearchIndex(ICON_NAMES, ICON_TAGS);

describe("searchIcons", () => {
	it("finds icons by their Tabler tags, not only by name", () => {
		const results = searchIcons(index, "money");
		expect(results).toContain("coin");
		expect(results).toContain("wallet");
	});

	it("requires every word of the query to match", () => {
		const results = searchIcons(index, "coin yen");
		expect(results).toContain("coin-yen");
		expect(results).not.toContain("coin-euro");
	});
});

describe("suggestIconFromWords", () => {
	it("picks an icon for a name made of words in the icon data", () => {
		expect(suggestIconFromWords(index, "Coffee")).toBe("coffee");
		expect(suggestIconFromWords(index, "Rake")).toBe("percentage");
	});

	it("suggests nothing for names the tag data cannot match", () => {
		expect(suggestIconFromWords(index, "報酬")).toBe("");
		expect(suggestIconFromWords(index, "Rakeback")).toBe("");
	});
});
