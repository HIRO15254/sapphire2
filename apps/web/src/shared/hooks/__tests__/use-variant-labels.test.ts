import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withQueryClient } from "@/__tests__/test-utils";

const trpcMocks = vi.hoisted(() => ({
	gameGroupListQueryFn: vi.fn(),
	gameVariantListQueryFn: vi.fn(),
	gameMixListQueryFn: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		gameGroup: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameGroup", "list"],
					queryFn: () => trpcMocks.gameGroupListQueryFn(),
				}),
			},
		},
		gameVariant: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameVariant", "list"],
					queryFn: () => trpcMocks.gameVariantListQueryFn(),
				}),
			},
		},
		gameMix: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameMix", "list"],
					queryFn: () => trpcMocks.gameMixListQueryFn(),
				}),
			},
		},
	},
}));

import { useVariantLabels } from "../use-variant-labels";

const GROUPS = [
	{
		id: "g-stud",
		builtinKey: "stud",
		label: "Stud",
		blind1Label: "Small Bet",
		blind2Label: "Big Bet",
		blind3Label: "Bring-in",
	},
	{
		id: "g-bigbet",
		builtinKey: "bigbet",
		label: "Big Bet",
		blind1Label: "SB",
		blind2Label: "BB",
		blind3Label: "Straddle",
	},
];

const VARIANTS = [
	{
		id: "v-razz",
		builtinKey: "razz",
		label: "Razz",
		shortLabel: "Razz",
		groupId: "g-stud",
		sortOrder: 0,
	},
];

describe("useVariantLabels", () => {
	beforeEach(() => {
		trpcMocks.gameGroupListQueryFn.mockReset();
		trpcMocks.gameVariantListQueryFn.mockReset();
		trpcMocks.gameMixListQueryFn.mockReset();
		trpcMocks.gameGroupListQueryFn.mockResolvedValue(GROUPS);
		trpcMocks.gameVariantListQueryFn.mockResolvedValue(VARIANTS);
		trpcMocks.gameMixListQueryFn.mockResolvedValue([]);
	});

	it("resolves a variant's labels from its owning group", async () => {
		const { result } = renderHook(() => useVariantLabels("Razz"), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => {
			expect(result.current).toEqual({
				blind1: "Small Bet",
				blind2: "Big Bet",
				blind3: "Bring-in",
			});
		});
	});

	it("matches case-insensitively", async () => {
		const { result } = renderHook(() => useVariantLabels("razz"), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => {
			expect(result.current.blind3).toBe("Bring-in");
		});
	});

	it("falls back to SB/BB/Straddle for unknown variants", async () => {
		const { result } = renderHook(() => useVariantLabels("Deleted Game"), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => {
			expect(result.current).toEqual({
				blind1: "SB",
				blind2: "BB",
				blind3: "Straddle",
			});
		});
	});
});
