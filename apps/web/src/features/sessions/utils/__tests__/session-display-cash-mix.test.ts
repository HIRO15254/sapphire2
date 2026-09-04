import { describe, expect, it } from "vitest";
import { buildCashRuleRows } from "@/features/sessions/utils/session-display";

describe("buildCashRuleRows (mix games)", () => {
	it("puts the table-size row last when cashMixGames is present", () => {
		const rows = buildCashRuleRows({
			cashAnte: null,
			cashAnteType: null,
			cashBlind1: null,
			cashBlind3: null,
			cashMixGames: [
				{
					name: "NLH",
					variants: ["NL Hold'em"],
					blind1: 1,
					blind2: 2,
					blind3: null,
					ante: null,
				},
			],
			cashTableSize: 9,
			cashVariant: null,
			ringGameBlind2: null,
		});
		expect(rows.at(-1)).toEqual({ label: "Table", value: "9-max" });
	});
});
