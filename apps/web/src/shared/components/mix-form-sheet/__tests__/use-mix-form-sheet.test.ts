import { QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, withQueryClient } from "@/__tests__/test-utils";

const trpcMocks = vi.hoisted(() => ({
	gameMixCreate: vi.fn(),
	gameMixUpdate: vi.fn(),
}));

const toastMock = vi.hoisted(() => ({
	error: vi.fn(),
	success: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		gameGroup: {
			list: { queryOptions: () => ({ queryKey: ["gameGroup", "list"] }) },
		},
		gameVariant: {
			list: { queryOptions: () => ({ queryKey: ["gameVariant", "list"] }) },
		},
		gameMix: {
			list: { queryOptions: () => ({ queryKey: ["gameMix", "list"] }) },
		},
	},
	trpcClient: {
		gameMix: {
			create: { mutate: trpcMocks.gameMixCreate },
			update: { mutate: trpcMocks.gameMixUpdate },
		},
	},
}));

vi.mock("sonner", () => ({ toast: toastMock }));

import { useMixFormSheet } from "../use-mix-form-sheet";

const VARIANTS = [
	{
		id: "v-1",
		builtinKey: null,
		label: "Limit Hold'em",
		shortLabel: "LHE",
		groupId: "g-1",
		sortOrder: 0,
	},
	{
		id: "v-2",
		builtinKey: null,
		label: "Razz",
		shortLabel: "Razz",
		groupId: "g-2",
		sortOrder: 1,
	},
	{
		id: "v-3",
		builtinKey: null,
		label: "Seven Card Stud",
		shortLabel: "Stud",
		groupId: "g-2",
		sortOrder: 2,
	},
];

function mixRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "m-1",
		builtinKey: "horse",
		label: "HORSE",
		games: ["v-1", "v-2", "v-3"],
		...overrides,
	};
}

describe("useMixFormSheet", () => {
	beforeEach(() => {
		trpcMocks.gameMixCreate.mockReset();
		trpcMocks.gameMixUpdate.mockReset();
		toastMock.error.mockReset();
	});

	it("starts blank in create mode", () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useMixFormSheet({
					editingMix: null,
					onOpenChange,
					variants: VARIANTS,
				}),
			{ wrapper: withQueryClient() }
		);
		expect(result.current.formTitle).toBe("Add game mix");
		expect(result.current.form.state.values).toEqual({ label: "", games: [] });
		expect(result.current.selectedGames).toEqual([]);
	});

	it("seeds the label and resolves the editing mix's game ids to labels, in order", () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useMixFormSheet({
					editingMix: mixRow(),
					onOpenChange,
					variants: VARIANTS,
				}),
			{ wrapper: withQueryClient() }
		);
		expect(result.current.formTitle).toBe("Edit game mix");
		expect(result.current.form.state.values).toEqual({
			label: "HORSE",
			games: ["v-1", "v-2", "v-3"],
		});
		expect(result.current.selectedGames).toEqual([
			{ id: "v-1", label: "Limit Hold'em" },
			{ id: "v-2", label: "Razz" },
			{ id: "v-3", label: "Seven Card Stud" },
		]);
	});

	it("falls back to the raw id when a seeded game id no longer resolves to a variant", () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useMixFormSheet({
					editingMix: mixRow({ games: ["v-1", "v-deleted"] }),
					onOpenChange,
					variants: VARIANTS,
				}),
			{ wrapper: withQueryClient() }
		);
		expect(result.current.selectedGames).toEqual([
			{ id: "v-1", label: "Limit Hold'em" },
			{ id: "v-deleted", label: "v-deleted" },
		]);
	});

	describe("onAddGame / onRemoveGame", () => {
		it("appends the id for a picked label, preserving append order", () => {
			const onOpenChange = vi.fn();
			const { result } = renderHook(
				() =>
					useMixFormSheet({
						editingMix: null,
						onOpenChange,
						variants: VARIANTS,
					}),
				{ wrapper: withQueryClient() }
			);
			act(() => {
				result.current.onAddGame("Razz");
			});
			act(() => {
				result.current.onAddGame("Limit Hold'em");
			});
			expect(result.current.form.state.values.games).toEqual(["v-2", "v-1"]);
			expect(result.current.selectedGames).toEqual([
				{ id: "v-2", label: "Razz" },
				{ id: "v-1", label: "Limit Hold'em" },
			]);
		});

		it("toasts on an unresolvable label instead of silently dropping it", () => {
			const onOpenChange = vi.fn();
			const { result } = renderHook(
				() =>
					useMixFormSheet({
						editingMix: null,
						onOpenChange,
						variants: VARIANTS,
					}),
				{ wrapper: withQueryClient() }
			);
			act(() => {
				result.current.onAddGame("Unknown Game");
			});
			expect(result.current.form.state.values.games).toEqual([]);
			expect(toastMock.error).toHaveBeenCalledTimes(1);
			expect(toastMock.error).toHaveBeenNthCalledWith(1, "Failed to add game");
		});

		it("does not toast when adding a resolvable label", () => {
			const onOpenChange = vi.fn();
			const { result } = renderHook(
				() =>
					useMixFormSheet({
						editingMix: null,
						onOpenChange,
						variants: VARIANTS,
					}),
				{ wrapper: withQueryClient() }
			);
			act(() => {
				result.current.onAddGame("Razz");
			});
			expect(result.current.form.state.values.games).toEqual(["v-2"]);
			expect(toastMock.error).not.toHaveBeenCalled();
		});

		it("resolves a just-created variant from the query cache before the prop updates (c19)", () => {
			// VariantSelect seeds the new row into gameVariant.list and calls
			// onChange synchronously; the `variants` prop is still the pre-creation
			// list, so the label must be resolved from the live cache instead.
			// gcTime must be non-zero: in the app gameVariant.list is observed by
			// useGameGroups, so a manually-seeded, observer-less query would only
			// be collected under the default test client's gcTime: 0.
			const client = new QueryClient({
				defaultOptions: {
					queries: { gcTime: Number.POSITIVE_INFINITY, retry: false },
				},
			});
			client.setQueryData(
				["gameVariant", "list"],
				[
					...VARIANTS,
					{
						id: "v-new",
						builtinKey: null,
						label: "Big O",
						shortLabel: "Big O",
						groupId: "g-1",
						sortOrder: 3,
					},
				]
			);
			const onOpenChange = vi.fn();
			const { result } = renderHook(
				() =>
					useMixFormSheet({
						editingMix: null,
						onOpenChange,
						variants: VARIANTS, // stale: does not contain "Big O"
					}),
				{ wrapper: withQueryClient(client) }
			);
			act(() => {
				result.current.onAddGame("Big O");
			});
			expect(result.current.form.state.values.games).toEqual(["v-new"]);
			expect(toastMock.error).not.toHaveBeenCalled();
		});

		it("ignores adding a label already selected", () => {
			const onOpenChange = vi.fn();
			const { result } = renderHook(
				() =>
					useMixFormSheet({
						editingMix: null,
						onOpenChange,
						variants: VARIANTS,
					}),
				{ wrapper: withQueryClient() }
			);
			act(() => {
				result.current.onAddGame("Razz");
			});
			act(() => {
				result.current.onAddGame("Razz");
			});
			expect(result.current.form.state.values.games).toEqual(["v-2"]);
		});

		it("removes a game by id, keeping the remaining order", () => {
			const onOpenChange = vi.fn();
			const { result } = renderHook(
				() =>
					useMixFormSheet({
						editingMix: mixRow(),
						onOpenChange,
						variants: VARIANTS,
					}),
				{ wrapper: withQueryClient() }
			);
			act(() => {
				result.current.onRemoveGame("v-2");
			});
			expect(result.current.form.state.values.games).toEqual(["v-1", "v-3"]);
		});
	});

	it("submits a create with ordered game ids and a trimmed label", async () => {
		trpcMocks.gameMixCreate.mockResolvedValue(mixRow({ id: "m-2" }));
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useMixFormSheet({
					editingMix: null,
					onOpenChange,
					variants: VARIANTS,
				}),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.form.setFieldValue("label", " My Mix ");
		});
		act(() => {
			result.current.onAddGame("Seven Card Stud");
		});
		act(() => {
			result.current.onAddGame("Limit Hold'em");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(trpcMocks.gameMixCreate).toHaveBeenCalledTimes(1);
		expect(trpcMocks.gameMixCreate).toHaveBeenNthCalledWith(1, {
			label: "My Mix",
			games: ["v-3", "v-1"],
		});
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(result.current.form.state.values.label).toBe("");
	});

	it("blocks a submit with fewer than 2 games", async () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useMixFormSheet({
					editingMix: null,
					onOpenChange,
					variants: VARIANTS,
				}),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.form.setFieldValue("label", "My Mix");
		});
		act(() => {
			result.current.onAddGame("Razz");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(trpcMocks.gameMixCreate).not.toHaveBeenCalled();
	});

	it("blocks a submit with zero games", async () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useMixFormSheet({
					editingMix: null,
					onOpenChange,
					variants: VARIANTS,
				}),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.form.setFieldValue("label", "My Mix");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(trpcMocks.gameMixCreate).not.toHaveBeenCalled();
	});

	it("blocks a submit with a blank label", async () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useMixFormSheet({
					editingMix: null,
					onOpenChange,
					variants: VARIANTS,
				}),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.form.setFieldValue("label", "   ");
		});
		act(() => {
			result.current.onAddGame("Razz");
		});
		act(() => {
			result.current.onAddGame("Limit Hold'em");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(trpcMocks.gameMixCreate).not.toHaveBeenCalled();
	});

	it("submits an edit as an update with the id and trimmed label", async () => {
		trpcMocks.gameMixUpdate.mockResolvedValue(mixRow());
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useMixFormSheet({
					editingMix: mixRow(),
					onOpenChange,
					variants: VARIANTS,
				}),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.form.setFieldValue("label", " HORSE Deluxe ");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(trpcMocks.gameMixUpdate).toHaveBeenCalledTimes(1);
		expect(trpcMocks.gameMixUpdate).toHaveBeenNthCalledWith(1, {
			id: "m-1",
			label: "HORSE Deluxe",
			games: ["v-1", "v-2", "v-3"],
		});
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
	});

	it("submits an edit with a game removed", async () => {
		trpcMocks.gameMixUpdate.mockResolvedValue(mixRow());
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useMixFormSheet({
					editingMix: mixRow(),
					onOpenChange,
					variants: VARIANTS,
				}),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.onRemoveGame("v-2");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(trpcMocks.gameMixUpdate).toHaveBeenNthCalledWith(1, {
			id: "m-1",
			label: "HORSE",
			games: ["v-1", "v-3"],
		});
	});

	it("blocks an edit submit dropped below 2 games", async () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useMixFormSheet({
					editingMix: mixRow({ games: ["v-1", "v-2"] }),
					onOpenChange,
					variants: VARIANTS,
				}),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.onRemoveGame("v-2");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(trpcMocks.gameMixUpdate).not.toHaveBeenCalled();
	});

	it("keeps the sheet open and toasts on create failure", async () => {
		trpcMocks.gameMixCreate.mockRejectedValue(new Error("CONFLICT"));
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useMixFormSheet({
					editingMix: null,
					onOpenChange,
					variants: VARIANTS,
				}),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.form.setFieldValue("label", "My Mix");
		});
		act(() => {
			result.current.onAddGame("Razz");
		});
		act(() => {
			result.current.onAddGame("Limit Hold'em");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		await waitFor(() => {
			expect(toastMock.error).toHaveBeenCalledTimes(1);
		});
		expect(toastMock.error).toHaveBeenNthCalledWith(
			1,
			"Failed to create game mix"
		);
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("keeps the sheet open and toasts on update failure", async () => {
		trpcMocks.gameMixUpdate.mockRejectedValue(new Error("CONFLICT"));
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useMixFormSheet({
					editingMix: mixRow(),
					onOpenChange,
					variants: VARIANTS,
				}),
			{ wrapper: withQueryClient() }
		);
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		await waitFor(() => {
			expect(toastMock.error).toHaveBeenCalledTimes(1);
		});
		expect(toastMock.error).toHaveBeenNthCalledWith(
			1,
			"Failed to update game mix"
		);
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("invalidates all three lists after a successful create", async () => {
		trpcMocks.gameMixCreate.mockResolvedValue(mixRow({ id: "m-2" }));
		const onOpenChange = vi.fn();
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = renderHook(
			() =>
				useMixFormSheet({
					editingMix: null,
					onOpenChange,
					variants: VARIANTS,
				}),
			{ wrapper: withQueryClient(queryClient) }
		);
		act(() => {
			result.current.form.setFieldValue("label", "My Mix");
		});
		act(() => {
			result.current.onAddGame("Razz");
		});
		act(() => {
			result.current.onAddGame("Limit Hold'em");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		await waitFor(() => {
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ["gameGroup", "list"],
			});
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ["gameVariant", "list"],
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ["gameMix", "list"],
		});
	});

	it("invalidates all three lists after a failed update too (onSettled)", async () => {
		trpcMocks.gameMixUpdate.mockRejectedValue(new Error("CONFLICT"));
		const onOpenChange = vi.fn();
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = renderHook(
			() =>
				useMixFormSheet({
					editingMix: mixRow(),
					onOpenChange,
					variants: VARIANTS,
				}),
			{ wrapper: withQueryClient(queryClient) }
		);
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		await waitFor(() => {
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ["gameMix", "list"],
			});
		});
	});

	it("resets the form and forwards the close through onOpenChange", () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useMixFormSheet({
					editingMix: null,
					onOpenChange,
					variants: VARIANTS,
				}),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.form.setFieldValue("label", "Draft");
		});
		act(() => {
			result.current.onAddGame("Razz");
		});
		act(() => {
			result.current.onOpenChange(false);
		});
		expect(result.current.form.state.values.label).toBe("");
		expect(result.current.form.state.values.games).toEqual([]);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("does not reset the form when onOpenChange is called with true", () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useMixFormSheet({
					editingMix: null,
					onOpenChange,
					variants: VARIANTS,
				}),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.form.setFieldValue("label", "Draft");
		});
		act(() => {
			result.current.onOpenChange(true);
		});
		expect(result.current.form.state.values.label).toBe("Draft");
		expect(onOpenChange).toHaveBeenCalledWith(true);
	});

	describe("onSaved", () => {
		it("calls onSaved once with the returned row on a successful create", async () => {
			const createdRow = mixRow({ id: "m-2", label: "My Mix" });
			trpcMocks.gameMixCreate.mockResolvedValue(createdRow);
			const onOpenChange = vi.fn();
			const onSaved = vi.fn();
			const { result } = renderHook(
				() =>
					useMixFormSheet({
						editingMix: null,
						onOpenChange,
						onSaved,
						variants: VARIANTS,
					}),
				{ wrapper: withQueryClient() }
			);
			act(() => {
				result.current.form.setFieldValue("label", "My Mix");
			});
			act(() => {
				result.current.onAddGame("Razz");
			});
			act(() => {
				result.current.onAddGame("Limit Hold'em");
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
			expect(onSaved).toHaveBeenNthCalledWith(1, createdRow, [
				"Limit Hold'em",
				"Razz",
				"Seven Card Stud",
			]);
		});

		it("calls onSaved once with the returned row on a successful update", async () => {
			const updatedRow = mixRow({ label: "HORSE Deluxe" });
			trpcMocks.gameMixUpdate.mockResolvedValue(updatedRow);
			const onOpenChange = vi.fn();
			const onSaved = vi.fn();
			const { result } = renderHook(
				() =>
					useMixFormSheet({
						editingMix: mixRow(),
						onOpenChange,
						onSaved,
						variants: VARIANTS,
					}),
				{ wrapper: withQueryClient() }
			);
			act(() => {
				result.current.form.setFieldValue("label", "HORSE Deluxe");
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
			expect(onSaved).toHaveBeenNthCalledWith(1, updatedRow, [
				"Limit Hold'em",
				"Razz",
				"Seven Card Stud",
			]);
		});

		it("resolves labels for the saved games itself, falling back to the raw id for unknown ids (c19)", async () => {
			const updatedRow = mixRow({ games: ["v-1", "v-unknown"] });
			trpcMocks.gameMixUpdate.mockResolvedValue(updatedRow);
			const onOpenChange = vi.fn();
			const onSaved = vi.fn();
			const { result } = renderHook(
				() =>
					useMixFormSheet({
						editingMix: mixRow(),
						onOpenChange,
						onSaved,
						variants: VARIANTS,
					}),
				{ wrapper: withQueryClient() }
			);
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
			expect(onSaved).toHaveBeenNthCalledWith(1, updatedRow, [
				"Limit Hold'em",
				"v-unknown",
			]);
		});

		it("does not call onSaved when the create mutation fails", async () => {
			trpcMocks.gameMixCreate.mockRejectedValue(new Error("CONFLICT"));
			const onOpenChange = vi.fn();
			const onSaved = vi.fn();
			const { result } = renderHook(
				() =>
					useMixFormSheet({
						editingMix: null,
						onOpenChange,
						onSaved,
						variants: VARIANTS,
					}),
				{ wrapper: withQueryClient() }
			);
			act(() => {
				result.current.form.setFieldValue("label", "My Mix");
			});
			act(() => {
				result.current.onAddGame("Razz");
			});
			act(() => {
				result.current.onAddGame("Limit Hold'em");
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			await waitFor(() => {
				expect(toastMock.error).toHaveBeenCalledTimes(1);
			});
			expect(onSaved).not.toHaveBeenCalled();
		});

		it("does not call onSaved when the update mutation fails", async () => {
			trpcMocks.gameMixUpdate.mockRejectedValue(new Error("CONFLICT"));
			const onOpenChange = vi.fn();
			const onSaved = vi.fn();
			const { result } = renderHook(
				() =>
					useMixFormSheet({
						editingMix: mixRow(),
						onOpenChange,
						onSaved,
						variants: VARIANTS,
					}),
				{ wrapper: withQueryClient() }
			);
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			await waitFor(() => {
				expect(toastMock.error).toHaveBeenCalledTimes(1);
			});
			expect(onSaved).not.toHaveBeenCalled();
		});

		it("does not throw on a successful update when onSaved is omitted", async () => {
			trpcMocks.gameMixUpdate.mockResolvedValue(mixRow());
			const onOpenChange = vi.fn();
			const { result } = renderHook(
				() =>
					useMixFormSheet({
						editingMix: mixRow(),
						onOpenChange,
						variants: VARIANTS,
					}),
				{ wrapper: withQueryClient() }
			);
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		});
	});
});
