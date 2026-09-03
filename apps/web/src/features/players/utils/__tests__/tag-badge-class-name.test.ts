import { describe, expect, it } from "vitest";
import { TAG_COLORS } from "@/features/players/constants/player-tag-colors";
import { tagBadgeClassName } from "@/features/players/utils/tag-badge-class-name";

describe("tagBadgeClassName", () => {
	it("returns the color config classes for a known color", () => {
		const result = tagBadgeClassName("red");

		expect(result).toContain(TAG_COLORS.red.bg);
		expect(result).toContain(TAG_COLORS.red.text);
	});

	it("falls back to gray for an unknown color", () => {
		const result = tagBadgeClassName("not-a-real-color");

		expect(result).toContain(TAG_COLORS.gray.bg);
		expect(result).toContain(TAG_COLORS.gray.text);
	});
});
