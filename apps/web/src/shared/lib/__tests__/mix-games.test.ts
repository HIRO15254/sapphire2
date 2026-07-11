import { describe, expect, it } from "vitest";
import {
	addGroup,
	addVariantToGroup,
	emptyMixGroupRow,
	fromLevelGames,
	fromMixGames,
	type MixGameGroupRow,
	mixTemplate,
	moveGroup,
	removeGroup,
	removeVariantFromGroup,
	toLevelGames,
	toMixGames,
	updateGroup,
	usedVariants,
} from "../mix-games";

function row(overrides: Partial<MixGameGroupRow> = {}): MixGameGroupRow {
	return {
		uid: crypto.randomUUID(),
		name: "Limit",
		variants: ["lhe", "o8"],
		blind1: "400",
		blind2: "800",
		blind3: "",
		ante: "",
		anteType: "none",
		...overrides,
	};
}

describe("emptyMixGroupRow", () => {
	it("creates a blank group with a fresh uid and no variants", () => {
		const a = emptyMixGroupRow();
		const b = emptyMixGroupRow();
		expect(a.uid).not.toBe(b.uid);
		expect(a.variants).toEqual([]);
		expect(a.name).toBe("");
		expect(a.blind1).toBe("");
		expect(a.anteType).toBe("none");
	});
});

describe("addGroup / removeGroup", () => {
	it("appends a blank group at the end", () => {
		const rows = [row()];
		const next = addGroup(rows);
		expect(next).toHaveLength(2);
		expect(next[1].variants).toEqual([]);
		expect(rows).toHaveLength(1);
	});

	it("removes the group with the given uid", () => {
		const a = row();
		const b = row({ name: "Stud" });
		expect(removeGroup([a, b], a.uid)).toEqual([b]);
	});

	it("removing an unknown uid is a no-op", () => {
		const a = row();
		expect(removeGroup([a], "nope")).toEqual([a]);
	});
});

describe("updateGroup", () => {
	it("patches only the matching group", () => {
		const a = row();
		const b = row({ name: "Stud" });
		const next = updateGroup([a, b], b.uid, { blind1: "100" });
		expect(next[0].blind1).toBe("400");
		expect(next[1].blind1).toBe("100");
		expect(next[1].name).toBe("Stud");
	});
});

describe("moveGroup", () => {
	it("moves a group up one position", () => {
		const a = row({ name: "A" });
		const b = row({ name: "B" });
		expect(moveGroup([a, b], b.uid, "up").map((r) => r.name)).toEqual([
			"B",
			"A",
		]);
	});

	it("moves a group down one position", () => {
		const a = row({ name: "A" });
		const b = row({ name: "B" });
		expect(moveGroup([a, b], a.uid, "down").map((r) => r.name)).toEqual([
			"B",
			"A",
		]);
	});

	it("moving the first group up is a no-op", () => {
		const a = row({ name: "A" });
		const b = row({ name: "B" });
		expect(moveGroup([a, b], a.uid, "up").map((r) => r.name)).toEqual([
			"A",
			"B",
		]);
	});

	it("moving the last group down is a no-op", () => {
		const a = row({ name: "A" });
		const b = row({ name: "B" });
		expect(moveGroup([a, b], b.uid, "down").map((r) => r.name)).toEqual([
			"A",
			"B",
		]);
	});

	it("moving an unknown uid is a no-op", () => {
		const a = row();
		expect(moveGroup([a], "nope", "up")).toEqual([a]);
	});
});

describe("addVariantToGroup / removeVariantFromGroup / usedVariants", () => {
	it("appends a variant to the matching group", () => {
		const a = row({ variants: ["lhe"] });
		const next = addVariantToGroup([a], a.uid, "o8");
		expect(next[0].variants).toEqual(["lhe", "o8"]);
	});

	it("refuses a variant already used in another group (case-insensitive)", () => {
		const a = row({ variants: ["Big Duck"] });
		const b = row({ name: "Stud", variants: [] });
		const next = addVariantToGroup([a, b], b.uid, "big duck");
		expect(next[1].variants).toEqual([]);
	});

	it("refuses a variant already present in the same group", () => {
		const a = row({ variants: ["nlh"] });
		const next = addVariantToGroup([a], a.uid, "nlh");
		expect(next[0].variants).toEqual(["nlh"]);
	});

	it("removes a variant from the matching group", () => {
		const a = row({ variants: ["lhe", "o8"] });
		const next = removeVariantFromGroup([a], a.uid, "lhe");
		expect(next[0].variants).toEqual(["o8"]);
	});

	it("removing the last variant keeps the (now empty) group", () => {
		const a = row({ variants: ["lhe"] });
		const next = removeVariantFromGroup([a], a.uid, "lhe");
		expect(next).toHaveLength(1);
		expect(next[0].variants).toEqual([]);
	});

	it("usedVariants collects every variant across groups in order", () => {
		const a = row({ variants: ["lhe", "o8"] });
		const b = row({ name: "Big Bet", variants: ["nlh"] });
		expect(usedVariants([a, b])).toEqual(["lhe", "o8", "nlh"]);
	});
});

describe("toMixGames", () => {
	it("converts rows to the shared payload shape", () => {
		const a = row({
			name: "Stud",
			variants: ["stud", "razz"],
			blind1: "400",
			blind2: "800",
			blind3: "100",
			ante: "75",
			anteType: "all",
		});
		expect(toMixGames([a])).toEqual([
			{
				name: "Stud",
				variants: ["stud", "razz"],
				blind1: 400,
				blind2: 800,
				blind3: 100,
				ante: 75,
				anteType: "all",
			},
		]);
	});

	it("maps empty numeric cells and blank names to null", () => {
		const a = row({
			name: "  ",
			variants: ["nlh", "plo"],
			blind1: "",
			blind2: "",
			blind3: "",
			ante: "",
			anteType: "none",
		});
		expect(toMixGames([a])).toEqual([
			{
				name: null,
				variants: ["nlh", "plo"],
				blind1: null,
				blind2: null,
				blind3: null,
				ante: null,
				anteType: "none",
			},
		]);
	});

	it("maps non-numeric and negative cells to null", () => {
		const a = row({ blind1: "abc", blind2: "-5", ante: "1.5" });
		const games = toMixGames([a]);
		expect(games?.[0].blind1).toBeNull();
		expect(games?.[0].blind2).toBeNull();
		expect(games?.[0].ante).toBeNull();
	});

	it("drops groups that have no variants", () => {
		const a = row();
		const empty = row({ variants: [] });
		expect(toMixGames([a, empty])).toHaveLength(1);
	});

	it("returns null when no group has variants", () => {
		expect(toMixGames([row({ variants: [] })])).toBeNull();
		expect(toMixGames([])).toBeNull();
	});
});

describe("fromMixGames", () => {
	it("round-trips payload groups back to editor rows with fresh uids", () => {
		const rows = fromMixGames([
			{
				name: "Limit",
				variants: ["lhe"],
				blind1: 400,
				blind2: 800,
				blind3: null,
				ante: null,
				anteType: null,
			},
		]);
		expect(rows).toHaveLength(1);
		expect(rows[0].uid).toBeTruthy();
		expect(rows[0].name).toBe("Limit");
		expect(rows[0].blind1).toBe("400");
		expect(rows[0].blind3).toBe("");
		expect(rows[0].anteType).toBe("none");
	});

	it("returns an empty array for null/undefined input", () => {
		expect(fromMixGames(null)).toEqual([]);
		expect(fromMixGames(undefined)).toEqual([]);
	});
});

describe("mixTemplate", () => {
	it("HORSE prefills flop and stud groups with blank amounts", () => {
		const rows = mixTemplate("horse");
		expect(rows.map((r) => r.name)).toEqual(["Flop", "Stud"]);
		expect(rows[0].variants).toEqual(["lhe", "o8"]);
		expect(rows[1].variants).toEqual(["razz", "stud", "stud8"]);
		expect(rows.every((r) => r.blind1 === "" && r.blind2 === "")).toBe(true);
	});

	it("8-Game prefills limit, stud, and big bet groups", () => {
		const rows = mixTemplate("8game");
		expect(rows.map((r) => r.name)).toEqual(["Limit", "Stud", "Big Bet"]);
		expect(rows[0].variants).toEqual(["27td", "lhe", "o8"]);
		expect(rows[2].variants).toEqual(["nlh", "plo"]);
	});

	it("10-Game adds badugi and NL single draw", () => {
		const rows = mixTemplate("10game");
		expect(rows[0].variants).toContain("badugi");
		expect(rows[2].variants).toContain("27sd");
	});

	it("every template row gets a unique uid", () => {
		const rows = mixTemplate("8game");
		expect(new Set(rows.map((r) => r.uid)).size).toBe(rows.length);
	});
});

describe("toLevelGames / fromLevelGames", () => {
	it("strips anteType from the payload (level groups have none)", () => {
		const games = toLevelGames([
			row({ variants: ["lhe"], anteType: "bb", ante: "75" }),
		]);
		expect(games).toEqual([
			{
				name: "Limit",
				variants: ["lhe"],
				blind1: 400,
				blind2: 800,
				blind3: null,
				ante: 75,
			},
		]);
	});

	it("returns null when no group has variants", () => {
		expect(toLevelGames([row({ variants: [] })])).toBeNull();
	});

	it("round-trips level groups back to editor rows with anteType none", () => {
		const rows = fromLevelGames([
			{ name: "Stud", variants: ["razz"], blind1: 300, blind2: 600 },
		]);
		expect(rows[0].name).toBe("Stud");
		expect(rows[0].anteType).toBe("none");
		expect(fromLevelGames(null)).toEqual([]);
	});
});
