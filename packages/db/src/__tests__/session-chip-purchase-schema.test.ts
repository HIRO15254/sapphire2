import { describe, expect, it } from "vitest";
import { sessionChipPurchase } from "../schema/session-chip-purchase";
import { fkByColumn, indexesOf } from "./test-utils";

describe("SessionChipPurchase — FK cascade policies", () => {
	it("sessionId FK cascades so the frozen snapshot dies with its session", () => {
		expect(fkByColumn(sessionChipPurchase, "session_id")).toEqual({
			columns: ["session_id"],
			foreignColumns: ["id"],
			foreignTable: "game_session",
			onDelete: "cascade",
		});
	});
});

describe("SessionChipPurchase — indexes", () => {
	it("indexes sessionId for per-session purchase lookups", () => {
		expect(indexesOf(sessionChipPurchase)).toEqual([
			{
				columns: ["session_id"],
				name: "session_chip_purchase_session_idx",
				unique: false,
				where: null,
			},
		]);
	});
});
