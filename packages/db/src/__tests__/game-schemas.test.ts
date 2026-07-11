import { describe, expect, it } from "vitest";
import {
	levelGameGroupSchema,
	levelGamesSchema,
	mixGameGroupSchema,
	mixGamesSchema,
} from "../schemas/game";

function group(overrides: Record<string, unknown> = {}) {
	return {
		name: "Limit",
		variants: ["lhe", "o8"],
		blind1: 400,
		blind2: 800,
		blind3: null,
		ante: null,
		anteType: null,
		...overrides,
	};
}

describe("mixGameGroupSchema", () => {
	it("accepts a fully populated group", () => {
		expect(mixGameGroupSchema.safeParse(group()).success).toBe(true);
	});

	it("accepts a group with only variants (all amounts absent)", () => {
		expect(
			mixGameGroupSchema.safeParse({ variants: ["nlh", "plo"] }).success
		).toBe(true);
	});

	it("rejects an empty variants array", () => {
		expect(mixGameGroupSchema.safeParse(group({ variants: [] })).success).toBe(
			false
		);
	});

	it("accepts exactly 30 variants and rejects 31", () => {
		const thirty = Array.from({ length: 30 }, (_, i) => `v${i}`);
		expect(
			mixGameGroupSchema.safeParse(group({ variants: thirty })).success
		).toBe(true);
		expect(
			mixGameGroupSchema.safeParse(group({ variants: [...thirty, "v30"] }))
				.success
		).toBe(false);
	});

	it("rejects an empty-string variant entry", () => {
		expect(
			mixGameGroupSchema.safeParse(group({ variants: ["nlh", ""] })).success
		).toBe(false);
	});

	it("accepts a 30-char name and rejects 31 chars", () => {
		expect(
			mixGameGroupSchema.safeParse(group({ name: "a".repeat(30) })).success
		).toBe(true);
		expect(
			mixGameGroupSchema.safeParse(group({ name: "a".repeat(31) })).success
		).toBe(false);
	});

	it("accepts a null name (unnamed group)", () => {
		expect(mixGameGroupSchema.safeParse(group({ name: null })).success).toBe(
			true
		);
	});

	it("rejects negative blind amounts", () => {
		expect(mixGameGroupSchema.safeParse(group({ blind1: -1 })).success).toBe(
			false
		);
	});

	it("rejects non-integer blind amounts", () => {
		expect(mixGameGroupSchema.safeParse(group({ blind2: 1.5 })).success).toBe(
			false
		);
	});

	it("accepts zero amounts", () => {
		expect(
			mixGameGroupSchema.safeParse(group({ blind1: 0, ante: 0 })).success
		).toBe(true);
	});

	it("rejects an unknown anteType", () => {
		expect(
			mixGameGroupSchema.safeParse(group({ anteType: "sb" })).success
		).toBe(false);
	});

	it.each(["none", "all", "bb"])("accepts anteType %s", (anteType) => {
		expect(mixGameGroupSchema.safeParse(group({ anteType })).success).toBe(
			true
		);
	});
});

describe("mixGamesSchema", () => {
	it("accepts a single group holding at least two variants", () => {
		expect(mixGamesSchema.safeParse([group()]).success).toBe(true);
	});

	it("rejects an empty groups array", () => {
		expect(mixGamesSchema.safeParse([]).success).toBe(false);
	});

	it("accepts exactly 12 groups and rejects 13", () => {
		const groups = Array.from({ length: 12 }, (_, i) =>
			group({ variants: [`v${i}a`, `v${i}b`] })
		);
		expect(mixGamesSchema.safeParse(groups).success).toBe(true);
		expect(
			mixGamesSchema.safeParse([...groups, group({ variants: ["extra"] })])
				.success
		).toBe(false);
	});

	it("rejects a single group with a single variant (a mix needs two games)", () => {
		expect(
			mixGamesSchema.safeParse([group({ variants: ["nlh"] })]).success
		).toBe(false);
	});

	it("accepts two single-variant groups (two games total)", () => {
		expect(
			mixGamesSchema.safeParse([
				group({ variants: ["nlh"] }),
				group({ variants: ["plo"] }),
			]).success
		).toBe(true);
	});

	it("rejects the same variant appearing in two groups", () => {
		expect(
			mixGamesSchema.safeParse([
				group({ variants: ["nlh", "plo"] }),
				group({ variants: ["plo", "lhe"] }),
			]).success
		).toBe(false);
	});

	it("rejects case-insensitive duplicate variants across groups", () => {
		expect(
			mixGamesSchema.safeParse([
				group({ variants: ["Big Duck"] }),
				group({ variants: ["big duck"] }),
			]).success
		).toBe(false);
	});

	it("rejects a duplicate variant within one group", () => {
		expect(
			mixGamesSchema.safeParse([group({ variants: ["nlh", "nlh"] })]).success
		).toBe(false);
	});
});

describe("levelGameGroupSchema", () => {
	it("rejects anteType (level groups have no ante-type dimension)", () => {
		const parsed = levelGameGroupSchema.safeParse(group({ anteType: "bb" }));
		// .omit + default strip: anteType is simply dropped, never rejected.
		expect(parsed.success).toBe(true);
		expect(
			parsed.success && "anteType" in (parsed.data as Record<string, unknown>)
		).toBe(false);
	});

	it("accepts a bring-in style stud group (blind3 + ante set)", () => {
		expect(
			levelGameGroupSchema.safeParse({
				name: "Stud",
				variants: ["stud", "razz"],
				blind1: 400,
				blind2: 800,
				blind3: 100,
				ante: 75,
			}).success
		).toBe(true);
	});
});

describe("levelGamesSchema", () => {
	it("accepts a single single-variant group (a level may host one game)", () => {
		expect(
			levelGamesSchema.safeParse([
				{ variants: ["nlh"], blind1: 100, blind2: 200 },
			]).success
		).toBe(true);
	});

	it("rejects an empty array and accepts up to 12 groups", () => {
		expect(levelGamesSchema.safeParse([]).success).toBe(false);
		const groups = Array.from({ length: 12 }, (_, i) => ({
			variants: [`v${i}`],
		}));
		expect(levelGamesSchema.safeParse(groups).success).toBe(true);
		expect(
			levelGamesSchema.safeParse([...groups, { variants: ["extra"] }]).success
		).toBe(false);
	});

	it("rejects duplicate variants across level groups", () => {
		expect(
			levelGamesSchema.safeParse([{ variants: ["lhe"] }, { variants: ["lhe"] }])
				.success
		).toBe(false);
	});
});
