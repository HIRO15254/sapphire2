import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, withQueryClient } from "@/__tests__/test-utils";

const trpcMocks = vi.hoisted(() => ({
	gameGroupListQueryFn: vi.fn(),
	gameVariantListQueryFn: vi.fn(),
	gameMixListQueryFn: vi.fn(),
	gameVariantCreate: vi.fn(),
}));

const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

const optimisticMocks = vi.hoisted(() => ({ updateQueryItems: vi.fn() }));

vi.mock("@/utils/optimistic-update", async () => {
	const actual = await vi.importActual<
		typeof import("@/utils/optimistic-update")
	>("@/utils/optimistic-update");
	return {
		...actual,
		updateQueryItems: vi.fn(
			(...args: Parameters<typeof actual.updateQueryItems>) => {
				optimisticMocks.updateQueryItems(...args);
				return actual.updateQueryItems(...args);
			}
		),
	};
});

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

import { useVariantSelect } from "../use-variant-select";

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
	const { result, rerender } = renderHook(
		(props: Partial<Parameters<typeof useVariantSelect>[0]> = {}) =>
			useVariantSelect({ onChange, value: "", ...args, ...props }),
		{ wrapper: withQueryClient() }
	);
	return { result, onChange, rerender };
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
			expect(result.current.filteredVariantOptions.map((o) => o.label)).toEqual(
				["NL Hold'em", "Limit Hold'em"]
			);
		});
		expect(result.current.filteredMixOptions).toEqual([]);
	});

	it("lists the user's mix masters as options when includeMix", async () => {
		const { result } = setup({ includeMix: true });
		await waitFor(() => {
			expect(result.current.filteredMixOptions).toEqual([
				{ id: "m-horse", label: "HORSE" },
				{ id: "m-8game", label: "8-Game" },
			]);
		});
	});

	it("hides mix masters when includeMix is false", async () => {
		const { result } = setup({ includeMix: false });
		await waitFor(() => {
			expect(result.current.filteredVariantOptions).toHaveLength(2);
		});
		expect(result.current.filteredMixOptions).toEqual([]);
	});

	it("treats a mix master's label as a known value", async () => {
		const { result } = setup({ value: "8-Game", includeMix: true });
		await waitFor(() => {
			expect(result.current.isKnownValue).toBe(true);
		});
	});

	it("treats the legacy 'mix' key as a known value", async () => {
		const { result } = setup({ value: "mix", includeMix: true });
		await waitFor(() => {
			expect(result.current.isKnownValue).toBe(true);
		});
	});

	it("does not apply excludeVariants filtering to mix masters", async () => {
		const { result } = setup({
			excludeVariants: ["HORSE", "8-Game"],
			includeMix: true,
		});
		await waitFor(() => {
			expect(result.current.filteredMixOptions).toEqual([
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
			expect(result.current.filteredVariantOptions.map((o) => o.label)).toEqual(
				["Limit Hold'em"]
			);
		});
	});

	it("flags an unknown frozen value (deleted variant)", async () => {
		const { result } = setup({ value: "Deleted Game" });
		await waitFor(() =>
			expect(result.current.filteredVariantOptions).toHaveLength(2)
		);
		expect(result.current.isKnownValue).toBe(false);
	});

	it("opens the add sheet without selecting anything", async () => {
		const { result, onChange } = setup();
		await waitFor(() =>
			expect(result.current.filteredVariantOptions).toHaveLength(2)
		);
		act(() => {
			result.current.handleOpenAdd();
		});
		expect(onChange).not.toHaveBeenCalled();
		expect(result.current.isAddOpen).toBe(true);
		expect(result.current.shouldShowPopover).toBe(false);
	});

	it("creates a variant with groupId and selects the new label", async () => {
		trpcMocks.gameVariantCreate.mockResolvedValue({
			id: "v-new",
			label: "Drawmaha",
		});
		const { result, onChange } = setup();
		await waitFor(() =>
			expect(result.current.filteredVariantOptions).toHaveLength(2)
		);
		act(() => {
			result.current.handleOpenAdd();
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
		await waitFor(() =>
			expect(result.current.filteredVariantOptions).toHaveLength(2)
		);
		act(() => {
			result.current.handleOpenAdd();
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
		await waitFor(() =>
			expect(result.current.filteredVariantOptions).toHaveLength(2)
		);
		act(() => {
			result.current.handleOpenAdd();
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

	it("seeds the created row into the variant list cache before onChange fires", async () => {
		const createdRow = {
			id: "v-new",
			builtinKey: null,
			label: "Drawmaha",
			shortLabel: null,
			groupId: "g-limit",
			sortOrder: 2,
		};
		optimisticMocks.updateQueryItems.mockClear();
		trpcMocks.gameVariantCreate.mockResolvedValue(createdRow);
		const queryClient = createTestQueryClient();
		const cacheAtChange: unknown[] = [];
		const onChange = vi.fn(() => {
			cacheAtChange.push(queryClient.getQueryData(["gameVariant", "list"]));
		});
		const { result } = renderHook(
			() => useVariantSelect({ onChange, value: "" }),
			{ wrapper: withQueryClient(queryClient) }
		);
		await waitFor(() =>
			expect(result.current.filteredVariantOptions).toHaveLength(2)
		);
		act(() => {
			result.current.handleOpenAdd();
		});
		act(() => {
			result.current.form.setFieldValue("label", "Drawmaha");
			result.current.form.setFieldValue("groupId", "g-limit");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
		expect(onChange).toHaveBeenNthCalledWith(1, "Drawmaha");
		// The label→id lookup a consumer performs inside onChange must already
		// see the created row (invalidation alone refetches too late).
		expect(cacheAtChange).toHaveLength(1);
		expect(cacheAtChange[0]).toEqual([...VARIANTS, createdRow]);
		expect(optimisticMocks.updateQueryItems).toHaveBeenCalledTimes(1);
		expect(optimisticMocks.updateQueryItems).toHaveBeenCalledWith(
			expect.anything(),
			["gameVariant", "list"],
			expect.any(Function)
		);
	});

	it("keeps the settled invalidation after seeding the cache", async () => {
		trpcMocks.gameVariantCreate.mockResolvedValue({
			id: "v-new",
			builtinKey: null,
			label: "Drawmaha",
			shortLabel: null,
			groupId: "g-limit",
			sortOrder: 2,
		});
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		const onChange = vi.fn();
		const { result } = renderHook(
			() => useVariantSelect({ onChange, value: "" }),
			{ wrapper: withQueryClient(queryClient) }
		);
		await waitFor(() =>
			expect(result.current.filteredVariantOptions).toHaveLength(2)
		);
		act(() => {
			result.current.handleOpenAdd();
		});
		act(() => {
			result.current.form.setFieldValue("label", "Drawmaha");
			result.current.form.setFieldValue("groupId", "g-limit");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		await waitFor(() => {
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ["gameVariant", "list"],
			});
		});
	});
});

describe("useVariantSelect — combobox filtering & selection", () => {
	beforeEach(() => {
		trpcMocks.gameGroupListQueryFn.mockReset();
		trpcMocks.gameVariantListQueryFn.mockReset();
		trpcMocks.gameMixListQueryFn.mockReset();
		trpcMocks.gameVariantCreate.mockReset();
		trpcMocks.gameGroupListQueryFn.mockResolvedValue(GROUPS);
		trpcMocks.gameVariantListQueryFn.mockResolvedValue(VARIANTS);
		trpcMocks.gameMixListQueryFn.mockResolvedValue(MIXES);
	});

	it("shows every option unfiltered on focus before typing", async () => {
		const { result } = setup({ includeMix: true });
		await waitFor(() =>
			expect(result.current.filteredVariantOptions).toHaveLength(2)
		);
		act(() => {
			result.current.handleInputFocus();
		});
		expect(result.current.shouldShowPopover).toBe(true);
		expect(result.current.filteredVariantOptions).toHaveLength(2);
		expect(result.current.filteredMixOptions).toHaveLength(2);
	});

	it("filters both lists by typed text, case-insensitively", async () => {
		const { result } = setup({ includeMix: true });
		await waitFor(() =>
			expect(result.current.filteredVariantOptions).toHaveLength(2)
		);
		act(() => {
			result.current.handleInputChange("hold");
		});
		expect(result.current.filteredVariantOptions.map((o) => o.label)).toEqual([
			"NL Hold'em",
			"Limit Hold'em",
		]);
		expect(result.current.filteredMixOptions).toEqual([]);
		act(() => {
			result.current.handleInputChange("8-GA");
		});
		expect(result.current.filteredVariantOptions).toEqual([]);
		expect(result.current.filteredMixOptions.map((o) => o.label)).toEqual([
			"8-Game",
		]);
	});

	it("does not commit a value while typing", async () => {
		const { result, onChange } = setup({ value: "NL Hold'em" });
		await waitFor(() =>
			expect(result.current.filteredVariantOptions).toHaveLength(2)
		);
		act(() => {
			result.current.handleInputChange("Limit");
		});
		expect(onChange).not.toHaveBeenCalled();
		expect(result.current.inputValue).toBe("Limit");
	});

	it("selecting an option commits the label and closes the popover", async () => {
		const { result, onChange } = setup();
		await waitFor(() =>
			expect(result.current.filteredVariantOptions).toHaveLength(2)
		);
		act(() => {
			result.current.handleInputFocus();
		});
		act(() => {
			result.current.handleSelect("Limit Hold'em");
		});
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenNthCalledWith(1, "Limit Hold'em");
		expect(result.current.shouldShowPopover).toBe(false);
	});

	it("selecting a different value than the current one still commits", async () => {
		const { result, onChange } = setup({ value: "NL Hold'em" });
		await waitFor(() =>
			expect(result.current.filteredVariantOptions).toHaveLength(2)
		);
		act(() => {
			result.current.handleSelect("Limit Hold'em");
		});
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenNthCalledWith(1, "Limit Hold'em");
	});

	it("re-selecting the current value keeps the input text and closes the popover", async () => {
		const { result, onChange } = setup({ value: "NL Hold'em" });
		await waitFor(() =>
			expect(result.current.filteredVariantOptions).toHaveLength(2)
		);
		act(() => {
			result.current.handleInputFocus();
		});
		act(() => {
			result.current.handleSelect("NL Hold'em");
		});
		expect(result.current.inputValue).toBe("NL Hold'em");
		expect(result.current.shouldShowPopover).toBe(false);
		expect(onChange).not.toHaveBeenCalled();
	});

	it("re-selecting the current value after typing restores the committed label", async () => {
		const { result } = setup({ value: "NL Hold'em" });
		await waitFor(() =>
			expect(result.current.filteredVariantOptions).toHaveLength(2)
		);
		act(() => {
			result.current.handleInputChange("nl");
		});
		act(() => {
			result.current.handleSelect("nl hold'em");
		});
		expect(result.current.inputValue).toBe("NL Hold'em");
		expect(result.current.shouldShowPopover).toBe(false);
	});

	it("blur outside the popover reverts typed text to the current value", async () => {
		const { result } = setup({ value: "NL Hold'em" });
		await waitFor(() =>
			expect(result.current.filteredVariantOptions).toHaveLength(2)
		);
		act(() => {
			result.current.handleInputChange("garbage");
		});
		act(() => {
			result.current.handleInputBlur(null);
		});
		expect(result.current.inputValue).toBe("NL Hold'em");
		expect(result.current.shouldShowPopover).toBe(false);
	});

	it("Enter selects the exact match", async () => {
		const { result, onChange } = setup();
		await waitFor(() =>
			expect(result.current.filteredVariantOptions).toHaveLength(2)
		);
		act(() => {
			result.current.handleInputChange("limit hold'em");
		});
		act(() => {
			result.current.handleKeyDown("Enter");
		});
		expect(onChange).toHaveBeenNthCalledWith(1, "Limit Hold'em");
	});

	it("Enter selects the sole remaining option", async () => {
		const { result, onChange } = setup({ includeMix: true });
		await waitFor(() =>
			expect(result.current.filteredVariantOptions).toHaveLength(2)
		);
		act(() => {
			result.current.handleInputChange("horse");
		});
		act(() => {
			result.current.handleKeyDown("Enter");
		});
		expect(onChange).toHaveBeenNthCalledWith(1, "HORSE");
	});

	it("Enter with multiple matches selects nothing", async () => {
		const { result, onChange } = setup();
		await waitFor(() =>
			expect(result.current.filteredVariantOptions).toHaveLength(2)
		);
		act(() => {
			result.current.handleInputChange("hold");
		});
		act(() => {
			result.current.handleKeyDown("Enter");
		});
		expect(onChange).not.toHaveBeenCalled();
	});

	it("Escape closes the popover and reverts the text", async () => {
		const { result } = setup({ value: "NL Hold'em" });
		await waitFor(() =>
			expect(result.current.filteredVariantOptions).toHaveLength(2)
		);
		act(() => {
			result.current.handleInputChange("xyz");
		});
		act(() => {
			result.current.handleKeyDown("Escape");
		});
		expect(result.current.inputValue).toBe("NL Hold'em");
		expect(result.current.shouldShowPopover).toBe(false);
	});

	it("prefills the add sheet with the typed text", async () => {
		const { result } = setup();
		await waitFor(() =>
			expect(result.current.filteredVariantOptions).toHaveLength(2)
		);
		act(() => {
			result.current.handleInputChange("Drawmaha");
		});
		act(() => {
			result.current.handleOpenAdd();
		});
		expect(result.current.isAddOpen).toBe(true);
		expect(result.current.form.state.values.label).toBe("Drawmaha");
		expect(result.current.inputValue).toBe("");
	});

	it("does not prefill the add sheet with an existing option's label", async () => {
		const { result } = setup();
		await waitFor(() =>
			expect(result.current.filteredVariantOptions).toHaveLength(2)
		);
		act(() => {
			result.current.handleInputChange("NL Hold'em");
		});
		act(() => {
			result.current.handleOpenAdd();
		});
		expect(result.current.form.state.values.label).toBe("");
	});

	it("syncs the input text when the value prop changes", async () => {
		const { result, rerender } = setup({ value: "NL Hold'em" });
		await waitFor(() =>
			expect(result.current.filteredVariantOptions).toHaveLength(2)
		);
		expect(result.current.inputValue).toBe("NL Hold'em");
		rerender({ value: "8-Game" });
		await waitFor(() => {
			expect(result.current.inputValue).toBe("8-Game");
		});
	});
});
