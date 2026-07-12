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

import { useGameGroups } from "../use-game-groups";

// Rows in server order: builtin canonical (limit, stud, bigbet) then customs.
const GROUP_ROWS = [
	{
		id: "g-limit",
		builtinKey: "limit",
		label: "Limit",
		blind1Label: "Small Bet",
		blind2Label: "Big Bet",
		blind3Label: null,
	},
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
	{
		id: "g-points",
		builtinKey: null,
		label: "Points",
		blind1Label: null,
		blind2Label: null,
		blind3Label: null,
	},
];

const VARIANT_ROWS = [
	{
		id: "v-nlh",
		builtinKey: "nlh",
		label: "NL Hold'em",
		shortLabel: "NLH",
		groupId: "g-bigbet",
		sortOrder: 0,
	},
	{
		id: "v-razz",
		builtinKey: "razz",
		label: "Razz",
		shortLabel: "Razz",
		groupId: "g-stud",
		sortOrder: 19,
	},
	{
		id: "v-ofc",
		builtinKey: null,
		label: "OFC",
		shortLabel: null,
		groupId: "g-points",
		sortOrder: 21,
	},
];

// 8-Game builtin mix, referencing two of the seeded VARIANT_ROWS plus one id
// whose variant row no longer exists (deleted since the mix was saved).
const MIX_ROWS = [
	{
		id: "m-8game",
		builtinKey: "8-game",
		label: "8-Game",
		games: ["v-nlh", "v-deleted", "v-razz"],
	},
];

function setup() {
	return renderHook(() => useGameGroups(), { wrapper: withQueryClient() });
}

describe("useGameGroups", () => {
	beforeEach(() => {
		trpcMocks.gameGroupListQueryFn.mockReset();
		trpcMocks.gameVariantListQueryFn.mockReset();
		trpcMocks.gameMixListQueryFn.mockReset();
		trpcMocks.gameGroupListQueryFn.mockResolvedValue(GROUP_ROWS);
		trpcMocks.gameVariantListQueryFn.mockResolvedValue(VARIANT_ROWS);
		trpcMocks.gameMixListQueryFn.mockResolvedValue(MIX_ROWS);
	});

	it("reports loading until all three masters resolve", async () => {
		const { result } = setup();
		expect(result.current.isLoading).toBe(true);
		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});
		expect(result.current.groups).toHaveLength(4);
		expect(result.current.variants).toHaveLength(3);
		expect(result.current.mixes).toHaveLength(1);
	});

	it("resolves a variant label to its owning group with canonical sortIndex", async () => {
		const { result } = setup();
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		const group = result.current.groupFor("Razz");
		expect(group.id).toBe("g-stud");
		expect(group.label).toBe("Stud");
		expect(group.blind3Label).toBe("Bring-in");
		expect(group.sortIndex).toBe(1);
	});

	it("matches variant labels case-insensitively", async () => {
		const { result } = setup();
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.groupFor("nl hold'em").id).toBe("g-bigbet");
	});

	it("parks unknown variant labels in the builtin big-bet group", async () => {
		const { result } = setup();
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.groupFor("Deleted Game").id).toBe("g-bigbet");
	});

	it("defaults missing labels of a user group to SB/BB and no third slot", async () => {
		const { result } = setup();
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		const labels = result.current.labelsFor("OFC");
		expect(labels).toEqual({ blind1: "SB", blind2: "BB", blind3: null });
	});

	it("falls back to straddle labels while data is empty", async () => {
		trpcMocks.gameGroupListQueryFn.mockResolvedValue([]);
		trpcMocks.gameVariantListQueryFn.mockResolvedValue([]);
		const { result } = setup();
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.labelsFor("NL Hold'em")).toEqual({
			blind1: "SB",
			blind2: "BB",
			blind3: "Straddle",
		});
		const fallback = result.current.groupFor("NL Hold'em");
		expect(fallback.label).toBe("Big Bet");
	});
});

describe("useGameGroups — isMixValue", () => {
	beforeEach(() => {
		trpcMocks.gameGroupListQueryFn.mockReset();
		trpcMocks.gameVariantListQueryFn.mockReset();
		trpcMocks.gameMixListQueryFn.mockReset();
		trpcMocks.gameGroupListQueryFn.mockResolvedValue(GROUP_ROWS);
		trpcMocks.gameVariantListQueryFn.mockResolvedValue(VARIANT_ROWS);
		trpcMocks.gameMixListQueryFn.mockResolvedValue(MIX_ROWS);
	});

	it("treats the legacy 'mix' key as a mix value", async () => {
		const { result } = setup();
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.isMixValue("mix")).toBe(true);
	});

	it("treats a mix master's label as a mix value", async () => {
		const { result } = setup();
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.isMixValue("8-Game")).toBe(true);
	});

	it("matches a mix label case-insensitively", async () => {
		const { result } = setup();
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.isMixValue("8-game")).toBe(true);
	});

	it("rejects a plain variant label", async () => {
		const { result } = setup();
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.isMixValue("NL Hold'em")).toBe(false);
	});
});

describe("useGameGroups — mixCompositionLabels", () => {
	beforeEach(() => {
		trpcMocks.gameGroupListQueryFn.mockReset();
		trpcMocks.gameVariantListQueryFn.mockReset();
		trpcMocks.gameMixListQueryFn.mockReset();
		trpcMocks.gameGroupListQueryFn.mockResolvedValue(GROUP_ROWS);
		trpcMocks.gameVariantListQueryFn.mockResolvedValue(VARIANT_ROWS);
		trpcMocks.gameMixListQueryFn.mockResolvedValue(MIX_ROWS);
	});

	it("resolves a mix's ordered game ids to variant labels, skipping deleted variants", async () => {
		const { result } = setup();
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		// v-nlh -> "NL Hold'em", v-deleted -> skipped, v-razz -> "Razz".
		expect(result.current.mixCompositionLabels("8-Game")).toEqual([
			"NL Hold'em",
			"Razz",
		]);
	});

	it("matches the mix label case-insensitively", async () => {
		const { result } = setup();
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.mixCompositionLabels("8-game")).toEqual([
			"NL Hold'em",
			"Razz",
		]);
	});

	it("returns an empty array for an unknown mix label", async () => {
		const { result } = setup();
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.mixCompositionLabels("10-Game")).toEqual([]);
	});
});
