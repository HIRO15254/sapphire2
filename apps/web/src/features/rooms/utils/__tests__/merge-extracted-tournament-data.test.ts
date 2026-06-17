import type { ExtractedTournamentData } from "@sapphire2/api/routers/ai-extract";
import { describe, expect, it } from "vitest";
import type { TournamentPartialFormValues } from "@/features/rooms/components/tournament-modal-content";
import { mergeExtractedTournamentData } from "@/features/rooms/utils/merge-extracted-tournament-data";

function base(
	partial: Partial<TournamentPartialFormValues> = {}
): TournamentPartialFormValues {
	return {
		name: "Existing",
		variant: "nlh",
		...partial,
	};
}

describe("mergeExtractedTournamentData", () => {
	describe("name", () => {
		it("uses the extracted name when it has text", () => {
			const result = mergeExtractedTournamentData(
				{ name: "AI Event" },
				base({ name: "Existing" })
			);
			expect(result.name).toBe("AI Event");
		});

		it("keeps the base name when extracted name is an empty string", () => {
			const result = mergeExtractedTournamentData(
				{ name: "" },
				base({ name: "Existing" })
			);
			expect(result.name).toBe("Existing");
		});

		it("keeps the base name when extracted name is whitespace only", () => {
			const result = mergeExtractedTournamentData(
				{ name: "   " },
				base({ name: "Existing" })
			);
			expect(result.name).toBe("Existing");
		});

		it("keeps the base name when extracted name is undefined", () => {
			const result = mergeExtractedTournamentData(
				{ name: undefined },
				base({ name: "Existing" })
			);
			expect(result.name).toBe("Existing");
		});

		it("falls back to empty string when neither extracted nor base have a name", () => {
			const result = mergeExtractedTournamentData({ name: "" }, undefined);
			expect(result.name).toBe("");
		});
	});

	describe("variant", () => {
		it("keeps the base variant", () => {
			const result = mergeExtractedTournamentData({}, base({ variant: "plo" }));
			expect(result.variant).toBe("plo");
		});

		it("defaults variant to nlh when base is undefined", () => {
			const result = mergeExtractedTournamentData({}, undefined);
			expect(result.variant).toBe("nlh");
		});
	});

	describe("numeric fields", () => {
		it("applies a meaningful positive number", () => {
			const result = mergeExtractedTournamentData(
				{ buyIn: 50 },
				base({ buyIn: 10 })
			);
			expect(result.buyIn).toBe(50);
		});

		it("keeps the base value when extracted number is undefined", () => {
			const result = mergeExtractedTournamentData(
				{ buyIn: undefined },
				base({ buyIn: 10 })
			);
			expect(result.buyIn).toBe(10);
		});

		it("keeps the base value when extracted number is zero", () => {
			const result = mergeExtractedTournamentData(
				{ buyIn: 0 },
				base({ buyIn: 10 })
			);
			expect(result.buyIn).toBe(10);
		});

		it("keeps the base value when extracted number is negative", () => {
			const result = mergeExtractedTournamentData(
				{ startingStack: -5 },
				base({ startingStack: 20_000 })
			);
			expect(result.startingStack).toBe(20_000);
		});

		it("keeps the base value when extracted number is NaN", () => {
			const result = mergeExtractedTournamentData(
				{ entryFee: Number.NaN },
				base({ entryFee: 5 })
			);
			expect(result.entryFee).toBe(5);
		});

		it("keeps the base value when extracted number is Infinity", () => {
			const result = mergeExtractedTournamentData(
				{ tableSize: Number.POSITIVE_INFINITY },
				base({ tableSize: 9 })
			);
			expect(result.tableSize).toBe(9);
		});

		it("leaves the field undefined when neither extracted nor base provide it", () => {
			const result = mergeExtractedTournamentData({ buyIn: 0 }, base());
			expect(result.buyIn).toBeUndefined();
		});

		it("applies all four numeric fields independently", () => {
			const result = mergeExtractedTournamentData(
				{ buyIn: 100, entryFee: 10, startingStack: 30_000, tableSize: 8 },
				base()
			);
			expect(result).toMatchObject({
				buyIn: 100,
				entryFee: 10,
				startingStack: 30_000,
				tableSize: 8,
			});
		});
	});

	describe("chipPurchases", () => {
		it("applies a non-empty extracted chipPurchases array", () => {
			const chipPurchases = [{ name: "Rebuy", cost: 50, chips: 10_000 }];
			const result = mergeExtractedTournamentData(
				{ chipPurchases },
				base({ chipPurchases: [] })
			);
			expect(result.chipPurchases).toEqual(chipPurchases);
		});

		it("keeps base chipPurchases when extracted array is empty", () => {
			const existing = [{ name: "Addon", cost: 30, chips: 5000 }];
			const result = mergeExtractedTournamentData(
				{ chipPurchases: [] },
				base({ chipPurchases: existing })
			);
			expect(result.chipPurchases).toBe(existing);
		});

		it("keeps base chipPurchases when extracted is undefined", () => {
			const existing = [{ name: "Addon", cost: 30, chips: 5000 }];
			const result = mergeExtractedTournamentData(
				{ chipPurchases: undefined },
				base({ chipPurchases: existing })
			);
			expect(result.chipPurchases).toBe(existing);
		});
	});

	describe("non-AI base fields", () => {
		it("preserves bountyAmount, currencyId, memo and tags from base", () => {
			const result = mergeExtractedTournamentData(
				{ name: "AI Event" },
				base({
					bountyAmount: 20,
					currencyId: "c1",
					memo: "note",
					tags: ["weekly"],
				})
			);
			expect(result).toMatchObject({
				bountyAmount: 20,
				currencyId: "c1",
				memo: "note",
				tags: ["weekly"],
			});
		});
	});

	it("does not overwrite anything when the entire extraction is blank", () => {
		const existing = base({
			name: "Existing",
			buyIn: 10,
			entryFee: 5,
			startingStack: 20_000,
			tableSize: 9,
			chipPurchases: [{ name: "Rebuy", cost: 50, chips: 10_000 }],
		});
		const blank: ExtractedTournamentData = {
			name: "",
			buyIn: undefined,
			entryFee: undefined,
			startingStack: undefined,
			tableSize: undefined,
			chipPurchases: [],
			blindLevels: [],
		};
		const result = mergeExtractedTournamentData(blank, existing);
		expect(result).toMatchObject({
			name: "Existing",
			buyIn: 10,
			entryFee: 5,
			startingStack: 20_000,
			tableSize: 9,
		});
		expect(result.chipPurchases).toEqual([
			{ name: "Rebuy", cost: 50, chips: 10_000 },
		]);
	});
});
