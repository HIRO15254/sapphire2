import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_VARIANTS } from "../constants";
import { gameVariant } from "../schema/game-variant";

describe("GameVariant schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(gameVariant);
		expect(columns.id).toBeDefined();
		expect(columns.userId).toBeDefined();
		expect(columns.name).toBeDefined();
		expect(columns.blindLabel1).toBeDefined();
		expect(columns.blindLabel2).toBeDefined();
		expect(columns.blindLabel3).toBeDefined();
		expect(columns.sortOrder).toBeDefined();
		expect(columns.archivedAt).toBeDefined();
		expect(columns.createdAt).toBeDefined();
		expect(columns.updatedAt).toBeDefined();
	});

	it("id is primary key", () => {
		const columns = getTableColumns(gameVariant);
		expect(columns.id.primary).toBe(true);
	});

	it("userId is not null", () => {
		const columns = getTableColumns(gameVariant);
		expect(columns.userId.notNull).toBe(true);
	});

	it("name is not null", () => {
		const columns = getTableColumns(gameVariant);
		expect(columns.name.notNull).toBe(true);
	});

	it("blindLabel1 is nullable", () => {
		const columns = getTableColumns(gameVariant);
		expect(columns.blindLabel1.notNull).toBe(false);
	});

	it("blindLabel2 is nullable", () => {
		const columns = getTableColumns(gameVariant);
		expect(columns.blindLabel2.notNull).toBe(false);
	});

	it("blindLabel3 is nullable", () => {
		const columns = getTableColumns(gameVariant);
		expect(columns.blindLabel3.notNull).toBe(false);
	});

	it("archivedAt is nullable", () => {
		const columns = getTableColumns(gameVariant);
		expect(columns.archivedAt.notNull).toBe(false);
	});
});

describe("GameVariant — defaults", () => {
	const columns = getTableColumns(gameVariant);

	it("sortOrder is not null and defaults to 0", () => {
		expect(columns.sortOrder.notNull).toBe(true);
		expect(columns.sortOrder.hasDefault).toBe(true);
		expect(columns.sortOrder.default).toBe(0);
	});

	it("createdAt is not null and has a default", () => {
		expect(columns.createdAt.notNull).toBe(true);
		expect(columns.createdAt.hasDefault).toBe(true);
	});

	it("updatedAt is not null and uses $onUpdate", () => {
		expect(columns.updatedAt.notNull).toBe(true);
		expect(columns.updatedAt.onUpdateFn).toBeInstanceOf(Function);
	});

	it("archivedAt is timestamp mode", () => {
		expect(columns.archivedAt.dataType).toBe("date");
	});
});

describe("GameVariant — FK cascade policies", () => {
	const config = getTableConfig(gameVariant);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("userId FK cascades on user deletion", () => {
		expect(fkByColumn("user_id")?.onDelete).toBe("cascade");
	});

	it("userId FK references the user id column", () => {
		const fk = fkByColumn("user_id")?.reference();
		expect(fk?.foreignColumns.map((c) => c.name)).toEqual(["id"]);
		expect(getTableConfig(fk?.foreignTable as never).name).toBe("user");
	});

	it("has exactly 1 foreign key", () => {
		expect(config.foreignKeys).toHaveLength(1);
	});
});

describe("GameVariant — indexes", () => {
	const config = getTableConfig(gameVariant);
	const idxNames = config.indexes.map((i) => i.config.name);

	it("has userId index for owner-scoped queries", () => {
		expect(idxNames).toContain("gameVariant_userId_idx");
	});

	it("has a unique index on (user_id, name)", () => {
		const uniqueIdx = config.indexes.find(
			(i) => i.config.name === "gameVariant_userId_name_unique"
		);
		expect(uniqueIdx).toBeDefined();
		expect((uniqueIdx?.config as unknown as { unique: boolean }).unique).toBe(
			true
		);
		const columns = uniqueIdx?.config.columns as unknown as {
			name: string;
		}[];
		expect(columns.map((c) => c.name)).toEqual(["user_id", "name"]);
	});

	it("has no composite primary key", () => {
		expect(config.primaryKeys).toHaveLength(0);
	});
});

describe("DEFAULT_GAME_VARIANTS", () => {
	it("has exactly 11 entries", () => {
		expect(DEFAULT_GAME_VARIANTS).toHaveLength(11);
	});

	it("has unique names", () => {
		const names = DEFAULT_GAME_VARIANTS.map((v) => v.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it("has NLH first", () => {
		expect(DEFAULT_GAME_VARIANTS[0].name).toBe("NLH");
	});

	it("NLH has SB/BB/Straddle blind labels", () => {
		const nlh = DEFAULT_GAME_VARIANTS[0];
		expect(nlh.blindLabel1).toBe("SB");
		expect(nlh.blindLabel2).toBe("BB");
		expect(nlh.blindLabel3).toBe("Straddle");
	});

	it("LHE has SB/BB and no third blind label", () => {
		const lhe = DEFAULT_GAME_VARIANTS.find((v) => v.name === "LHE");
		expect(lhe?.blindLabel1).toBe("SB");
		expect(lhe?.blindLabel2).toBe("BB");
		expect(lhe?.blindLabel3).toBeNull();
	});

	it("Short Deck has only a Button blind label", () => {
		const shortDeck = DEFAULT_GAME_VARIANTS.find(
			(v) => v.name === "Short Deck"
		);
		expect(shortDeck?.blindLabel1).toBe("Button blind");
		expect(shortDeck?.blindLabel2).toBeNull();
		expect(shortDeck?.blindLabel3).toBeNull();
	});

	it("Stud and Razz have only a Bring-in blind label", () => {
		const stud = DEFAULT_GAME_VARIANTS.find((v) => v.name === "Stud");
		const razz = DEFAULT_GAME_VARIANTS.find((v) => v.name === "Razz");
		for (const variant of [stud, razz]) {
			expect(variant?.blindLabel1).toBe("Bring-in");
			expect(variant?.blindLabel2).toBeNull();
			expect(variant?.blindLabel3).toBeNull();
		}
	});

	it("PLO/PLO5/PLO8 have SB/BB/Straddle blind labels", () => {
		for (const name of ["PLO", "PLO5", "PLO8"]) {
			const variant = DEFAULT_GAME_VARIANTS.find((v) => v.name === name);
			expect(variant?.blindLabel1).toBe("SB");
			expect(variant?.blindLabel2).toBe("BB");
			expect(variant?.blindLabel3).toBe("Straddle");
		}
	});

	it("2-7 Triple Draw, Badugi, and Mixed have SB/BB and no third blind label", () => {
		for (const name of ["2-7 Triple Draw", "Badugi", "Mixed"]) {
			const variant = DEFAULT_GAME_VARIANTS.find((v) => v.name === name);
			expect(variant?.blindLabel1).toBe("SB");
			expect(variant?.blindLabel2).toBe("BB");
			expect(variant?.blindLabel3).toBeNull();
		}
	});
});
