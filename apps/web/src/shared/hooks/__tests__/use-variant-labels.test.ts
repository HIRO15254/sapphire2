import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withQueryClient } from "@/__tests__/test-utils";

const trpcMocks = vi.hoisted(() => ({
	gameVariantListQueryFn: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		gameVariant: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameVariant", "list"],
					queryFn: () => trpcMocks.gameVariantListQueryFn(),
				}),
			},
		},
	},
	trpcClient: {},
}));

import { useVariantLabels } from "../use-variant-labels";

function customRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "cv-1",
		userId: "u-1",
		label: "Big Duck",
		blind1Label: "Button",
		blind2Label: null,
		blind3Label: "Cap",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

describe("useVariantLabels", () => {
	beforeEach(() => {
		trpcMocks.gameVariantListQueryFn.mockReset();
		trpcMocks.gameVariantListQueryFn.mockResolvedValue([]);
	});

	it("returns preset labels for a preset key without any custom rows", () => {
		const { result } = renderHook(() => useVariantLabels("stud"), {
			wrapper: withQueryClient(),
		});
		expect(result.current).toEqual({
			blind1: "Small Bet",
			blind2: "Big Bet",
			blind3: "Bring-in",
		});
	});

	it("resolves a custom variant label case-insensitively with SB/BB fallbacks", async () => {
		trpcMocks.gameVariantListQueryFn.mockResolvedValue([customRow()]);
		const { result } = renderHook(() => useVariantLabels("big duck"), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => {
			expect(result.current).toEqual({
				blind1: "Button",
				blind2: "BB",
				blind3: "Cap",
			});
		});
	});

	it("keeps a custom blind3Label of null as null (no third slot)", async () => {
		trpcMocks.gameVariantListQueryFn.mockResolvedValue([
			customRow({ blind1Label: null, blind3Label: null }),
		]);
		const { result } = renderHook(() => useVariantLabels("Big Duck"), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => {
			expect(result.current).toEqual({
				blind1: "SB",
				blind2: "BB",
				blind3: null,
			});
		});
	});

	it("falls back to SB/BB/Straddle for an unknown variant", async () => {
		trpcMocks.gameVariantListQueryFn.mockResolvedValue([customRow()]);
		const { result } = renderHook(() => useVariantLabels("Vanished Game"), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => {
			expect(trpcMocks.gameVariantListQueryFn).toHaveBeenCalledTimes(1);
		});
		expect(result.current).toEqual({
			blind1: "SB",
			blind2: "BB",
			blind3: "Straddle",
		});
	});

	it("returns defaults while the custom list is still loading", () => {
		trpcMocks.gameVariantListQueryFn.mockReturnValue(new Promise(() => 0));
		const { result } = renderHook(() => useVariantLabels("Big Duck"), {
			wrapper: withQueryClient(),
		});
		expect(result.current).toEqual({
			blind1: "SB",
			blind2: "BB",
			blind3: "Straddle",
		});
	});
});
