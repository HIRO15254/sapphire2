import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withQueryClient } from "@/__tests__/test-utils";

const trpcMocks = vi.hoisted(() => ({
	gameGroupListQueryFn: vi.fn(),
	gameVariantListQueryFn: vi.fn(),
	gameMixListQueryFn: vi.fn(),
	gameVariantCreate: vi.fn(),
}));

const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

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
	trpcClient: {
		gameVariant: {
			create: { mutate: trpcMocks.gameVariantCreate },
		},
	},
}));

vi.mock("sonner", () => ({ toast: toastMock }));

import { ADD_CUSTOM_VALUE, useVariantSelect } from "../use-variant-select";

const GROUPS = [
	{ id: "g-limit", builtinKey: "limit", label: "Limit" },
	{ id: "g-bigbet", builtinKey: "bigbet", label: "Big Bet" },
];

const VARIANTS = [
	{
		id: "v-nlh",
		builtinKey: "nlh",
		label: "NL Hold'em",
		shortLabel: "NLH",
		groupId: "g-bigbet",
		sortOrder: 0,
	},
	{
		id: "v-lhe",
		builtinKey: "lhe",
		label: "Limit Hold'em",
		shortLabel: "LHE",
		groupId: "g-limit",
		sortOrder: 1,
	},
];

const MIXES = [
	{ id: "m-horse", builtinKey: "horse", label: "HORSE", games: [] },
	{ id: "m-8game", builtinKey: "8-game", label: "8-Game", games: [] },
];

function setup(args: Partial<Parameters<typeof useVariantSelect>[0]> = {}) {
	const onChange = vi.fn();
	const { result } = renderHook(
		() => useVariantSelect({ onChange, value: "", ...args }),
		{ wrapper: withQueryClient() }
	);
	return { result, onChange };
}

describe("useVariantSelect", () => {
	beforeEach(() => {
		trpcMocks.gameGroupListQueryFn.mockReset();
		trpcMocks.gameVariantListQueryFn.mockReset();
		trpcMocks.gameMixListQueryFn.mockReset();
		trpcMocks.gameVariantCreate.mockReset();
		toastMock.error.mockReset();
		trpcMocks.gameGroupListQueryFn.mockResolvedValue(GROUPS);
		trpcMocks.gameVariantListQueryFn.mockResolvedValue(VARIANTS);
		trpcMocks.gameMixListQueryFn.mockResolvedValue(MIXES);
	});

	it("lists the user's variant rows as options (value = label)", async () => {
		const { result } = setup();
		await waitFor(() => {
			expect(result.current.variantOptions.map((o) => o.label)).toEqual([
				"NL Hold'em",
				"Limit Hold'em",
			]);
		});
		expect(result.current.mixOptions).toEqual([]);
	});

	it("lists the user's mix masters as options when includeMix", async () => {
		const { result } = setup({ includeMix: true });
		await waitFor(() => {
			expect(result.current.mixOptions).toEqual([
				{ id: "m-horse", label: "HORSE" },
				{ id: "m-8game", label: "8-Game" },
			]);
		});
	});

	it("hides mix masters when includeMix is false", async () => {
		const { result } = setup({ includeMix: false });
		await waitFor(() => {
			expect(result.current.variantOptions).toHaveLength(2);
		});
		expect(result.current.mixOptions).toEqual([]);
	});

	it("treats a mix master's label as a known value", async () => {
		const { result } = setup({ value: "8-Game", includeMix: true });
		await waitFor(() => {
			expect(result.current.unknownValue).toBeNull();
		});
	});

	it("treats the legacy 'mix' key as a known value", async () => {
		const { result } = setup({ value: "mix", includeMix: true });
		await waitFor(() => {
			expect(result.current.unknownValue).toBeNull();
		});
	});

	it("does not apply excludeVariants filtering to mix masters", async () => {
		const { result } = setup({
			excludeVariants: ["HORSE", "8-Game"],
			includeMix: true,
		});
		await waitFor(() => {
			expect(result.current.mixOptions).toEqual([
				{ id: "m-horse", label: "HORSE" },
				{ id: "m-8game", label: "8-Game" },
			]);
		});
	});

	it("hides excluded labels except the current value (case-insensitive)", async () => {
		const { result } = setup({
			excludeVariants: ["nl hold'em", "LIMIT HOLD'EM"],
			value: "Limit Hold'em",
		});
		await waitFor(() => {
			expect(result.current.variantOptions.map((o) => o.label)).toEqual([
				"Limit Hold'em",
			]);
		});
	});

	it("surfaces an unknown frozen value as its own option", async () => {
		const { result } = setup({ value: "Deleted Game" });
		await waitFor(() => {
			expect(result.current.unknownValue).toBe("Deleted Game");
		});
	});

	it("intercepts the add-custom sentinel instead of selecting it", async () => {
		const { result, onChange } = setup();
		await waitFor(() => expect(result.current.variantOptions).toHaveLength(2));
		act(() => {
			result.current.handleValueChange(ADD_CUSTOM_VALUE);
		});
		expect(onChange).not.toHaveBeenCalled();
		expect(result.current.isAddOpen).toBe(true);
	});

	it("creates a variant with groupId and selects the new label", async () => {
		trpcMocks.gameVariantCreate.mockResolvedValue({
			id: "v-new",
			label: "Drawmaha",
		});
		const { result, onChange } = setup();
		await waitFor(() => expect(result.current.variantOptions).toHaveLength(2));
		act(() => {
			result.current.handleValueChange(ADD_CUSTOM_VALUE);
		});
		act(() => {
			result.current.form.setFieldValue("label", "Drawmaha");
			result.current.form.setFieldValue("groupId", "g-limit");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		await waitFor(() => {
			expect(result.current.isAddOpen).toBe(false);
		});
		expect(trpcMocks.gameVariantCreate).toHaveBeenCalledTimes(1);
		expect(trpcMocks.gameVariantCreate).toHaveBeenNthCalledWith(1, {
			label: "Drawmaha",
			shortLabel: null,
			groupId: "g-limit",
		});
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenNthCalledWith(1, "Drawmaha");
	});

	it("blocks creation without a group", async () => {
		const { result } = setup();
		await waitFor(() => expect(result.current.variantOptions).toHaveLength(2));
		act(() => {
			result.current.handleValueChange(ADD_CUSTOM_VALUE);
		});
		act(() => {
			result.current.form.setFieldValue("label", "Drawmaha");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(trpcMocks.gameVariantCreate).not.toHaveBeenCalled();
	});

	it("keeps the sheet open and toasts on create failure", async () => {
		trpcMocks.gameVariantCreate.mockRejectedValue(new Error("CONFLICT"));
		const { result } = setup();
		await waitFor(() => expect(result.current.variantOptions).toHaveLength(2));
		act(() => {
			result.current.handleValueChange(ADD_CUSTOM_VALUE);
		});
		act(() => {
			result.current.form.setFieldValue("label", "Drawmaha");
			result.current.form.setFieldValue("groupId", "g-limit");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		await waitFor(() => {
			expect(toastMock.error).toHaveBeenCalledTimes(1);
		});
		expect(result.current.isAddOpen).toBe(true);
	});
});
