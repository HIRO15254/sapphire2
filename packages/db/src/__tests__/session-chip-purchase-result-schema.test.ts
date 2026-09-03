import { describe, expect, it } from "vitest";
import { sessionChipPurchaseResult } from "../schema/session-chip-purchase-result";
import { fkByColumn } from "./test-utils";

describe("SessionChipPurchaseResult — FK cascade policies", () => {
	it("sessionChipPurchaseId FK cascades so the result dies with its purchase row", () => {
		expect(
			fkByColumn(sessionChipPurchaseResult, "session_chip_purchase_id")
		).toEqual({
			columns: ["session_chip_purchase_id"],
			foreignColumns: ["id"],
			foreignTable: "session_chip_purchase",
			onDelete: "cascade",
		});
	});
});
