import { act, renderHook, waitFor } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, withQueryClient } from "@/__tests__/test-utils";

const trpcMocks = vi.hoisted(() => ({
	gameGroupListQueryFn: vi.fn(),
	gameVariantListQueryFn: vi.fn(),
	gameMixListQueryFn: vi.fn(),
	gameGroupDelete: vi.fn(),
	gameVariantDelete: vi.fn(),
	gameMixDelete: vi.fn(),
}));

const toastMock = vi.hoisted(() => ({
	error: vi.fn(),
	success: vi.fn(),
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
	trpcClient: {
		gameGroup: {
			delete: { mutate: trpcMocks.gameGroupDelete },
		},
		gameVariant: {
			delete: { mutate: trpcMocks.gameVariantDelete },
		},
		gameMix: {
			delete: { mutate: trpcMocks.gameMixDelete },
		},
	},
}));

vi.mock("sonner", () => ({ toast: toastMock }));

import { useGamesPage } from "../use-games-page";

function groupRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "g-1",
		userId: "u-1",
		builtinKey: "nlh",
		label: "No Limit Hold'em",
		blind1Label: null,
		blind2Label: null,
		blind3Label: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

function variantRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "v-1",
		userId: "u-1",
		builtinKey: null,
		label: "Big Duck",
		shortLabel: "BD",
		groupId: "g-1",
		sortOrder: 0,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

function mixRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "m-1",
		userId: "u-1",
		builtinKey: "horse",
		label: "HORSE",
		games: ["v-1"],
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

describe("useGamesPage", () => {
	beforeEach(() => {
		trpcMocks.gameGroupListQueryFn.mockReset();
		trpcMocks.gameGroupListQueryFn.mockResolvedValue([groupRow()]);
		trpcMocks.gameVariantListQueryFn.mockReset();
		trpcMocks.gameVariantListQueryFn.mockResolvedValue([variantRow()]);
		trpcMocks.gameMixListQueryFn.mockReset();
		trpcMocks.gameMixListQueryFn.mockResolvedValue([mixRow()]);
		trpcMocks.gameGroupDelete.mockReset();
		trpcMocks.gameVariantDelete.mockReset();
		trpcMocks.gameMixDelete.mockReset();
		toastMock.error.mockReset();
	});

	it("is loading until the group, variant, and mix lists resolve", async () => {
		const { result } = renderHook(() => useGamesPage(), {
			wrapper: withQueryClient(),
		});
		expect(result.current.isLoading).toBe(true);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
	});

	it("stays loading while only the mix list is still pending", () => {
		trpcMocks.gameMixListQueryFn.mockReturnValue(new Promise(() => undefined));
		const { result } = renderHook(() => useGamesPage(), {
			wrapper: withQueryClient(),
		});
		expect(result.current.isLoading).toBe(true);
	});

	it("exposes an error and refetches every master list when one list fails", async () => {
		trpcMocks.gameVariantListQueryFn.mockRejectedValueOnce(
			new Error("variant list unavailable")
		);
		const { result } = renderHook(() => useGamesPage(), {
			wrapper: withQueryClient(),
		});

		await waitFor(() => expect(result.current.isError).toBe(true));

		act(() => {
			result.current.onRetry();
		});

		await waitFor(() => expect(result.current.isError).toBe(false));
		expect(trpcMocks.gameGroupListQueryFn).toHaveBeenCalledTimes(2);
		expect(trpcMocks.gameVariantListQueryFn).toHaveBeenCalledTimes(2);
		expect(trpcMocks.gameMixListQueryFn).toHaveBeenCalledTimes(2);
	});

	it("exposes the mix list and the flat variant rows", async () => {
		const { result } = renderHook(() => useGamesPage(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.mixes).toEqual([mixRow()]);
		expect(result.current.variants).toEqual([variantRow()]);
	});

	it("groups variants under their owning group, preserving server group order", async () => {
		trpcMocks.gameGroupListQueryFn.mockResolvedValue([
			groupRow({ id: "g-1", label: "Hold'em" }),
			groupRow({ id: "g-2", builtinKey: null, label: "Stud" }),
		]);
		trpcMocks.gameVariantListQueryFn.mockResolvedValue([
			variantRow({ id: "v-1", groupId: "g-1", label: "NLH" }),
			variantRow({ id: "v-2", groupId: "g-2", label: "7-Stud" }),
		]);
		const { result } = renderHook(() => useGamesPage(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.groups).toHaveLength(2);
		expect(result.current.groups[0].group.id).toBe("g-1");
		expect(result.current.groups[0].variants.map((v) => v.id)).toEqual(["v-1"]);
		expect(result.current.groups[1].group.id).toBe("g-2");
		expect(result.current.groups[1].variants.map((v) => v.id)).toEqual(["v-2"]);
	});

	it("sorts a group's variants by sortOrder, then label", async () => {
		trpcMocks.gameVariantListQueryFn.mockResolvedValue([
			variantRow({ id: "v-3", label: "Zeta", sortOrder: 1 }),
			variantRow({ id: "v-1", label: "Big Duck", sortOrder: 0 }),
			variantRow({ id: "v-2", label: "Alpha", sortOrder: 1 }),
		]);
		const { result } = renderHook(() => useGamesPage(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.groups[0].variants.map((v) => v.id)).toEqual([
			"v-1",
			"v-2",
			"v-3",
		]);
	});

	it("includes a group with no variants as an empty entry", async () => {
		trpcMocks.gameVariantListQueryFn.mockResolvedValue([]);
		const { result } = renderHook(() => useGamesPage(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.groups).toHaveLength(1);
		expect(result.current.groups[0].variants).toEqual([]);
	});

	it("exposes flat group options for the variant sheet's select", async () => {
		const { result } = renderHook(() => useGamesPage(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.groupOptions).toEqual([
			{ id: "g-1", label: "No Limit Hold'em" },
		]);
	});

	describe("referential stability", () => {
		it("keeps the same groups and groupOptions array identity across a rerender with unchanged data", async () => {
			const { result, rerender } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			const { groups, groupOptions } = result.current;
			rerender();
			expect(result.current.groups).toBe(groups);
			expect(result.current.groupOptions).toBe(groupOptions);
		});
	});

	describe("group sheet", () => {
		it("opens in create mode with no editing target", async () => {
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onAddGroup();
			});
			expect(result.current.isGroupSheetOpen).toBe(true);
			expect(result.current.editingGroup).toBeNull();
		});

		it("opens in edit mode with the picked group", async () => {
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onEditGroup(result.current.groups[0].group);
			});
			expect(result.current.isGroupSheetOpen).toBe(true);
			expect(result.current.editingGroup?.id).toBe("g-1");
		});

		it("closes and clears the editing target when open is set to false", async () => {
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onEditGroup(result.current.groups[0].group);
			});
			act(() => {
				result.current.onGroupSheetOpenChange(false);
			});
			expect(result.current.isGroupSheetOpen).toBe(false);
			expect(result.current.editingGroup).toBeNull();
		});
	});

	describe("variant sheet", () => {
		it("opens in create mode preselected with the tapped group's id", async () => {
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onAddVariant("g-1");
			});
			expect(result.current.isVariantSheetOpen).toBe(true);
			expect(result.current.createGroupId).toBe("g-1");
			expect(result.current.editingVariant).toBeNull();
		});

		it("opens in edit mode with the picked variant and no preselected group", async () => {
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onEditVariant(result.current.groups[0].variants[0]);
			});
			expect(result.current.isVariantSheetOpen).toBe(true);
			expect(result.current.editingVariant?.id).toBe("v-1");
			expect(result.current.createGroupId).toBeNull();
		});

		it("closes and clears both the editing target and the preselected group", async () => {
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onAddVariant("g-1");
			});
			act(() => {
				result.current.onVariantSheetOpenChange(false);
			});
			expect(result.current.isVariantSheetOpen).toBe(false);
			expect(result.current.createGroupId).toBeNull();
			expect(result.current.editingVariant).toBeNull();
		});
	});

	describe("mix sheet", () => {
		it("opens in create mode with no editing target", async () => {
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onAddMix();
			});
			expect(result.current.isMixSheetOpen).toBe(true);
			expect(result.current.editingMix).toBeNull();
		});

		it("opens in edit mode with the picked mix", async () => {
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onEditMix(result.current.mixes[0]);
			});
			expect(result.current.isMixSheetOpen).toBe(true);
			expect(result.current.editingMix?.id).toBe("m-1");
		});

		it("closes and clears the editing target when open is set to false", async () => {
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onEditMix(result.current.mixes[0]);
			});
			act(() => {
				result.current.onMixSheetOpenChange(false);
			});
			expect(result.current.isMixSheetOpen).toBe(false);
			expect(result.current.editingMix).toBeNull();
		});
	});

	describe("group delete", () => {
		it("blocks the request and toasts when the group still has variants", async () => {
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onDeleteGroupRequest(result.current.groups[0].group);
			});
			expect(toastMock.error).toHaveBeenNthCalledWith(
				1,
				"Remove or reassign its variants first"
			);
			expect(result.current.deletingGroup).toBeNull();
			expect(trpcMocks.gameGroupDelete).not.toHaveBeenCalled();
		});

		it("opens the confirm dialog for an empty group", async () => {
			trpcMocks.gameVariantListQueryFn.mockResolvedValue([]);
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onDeleteGroupRequest(result.current.groups[0].group);
			});
			expect(result.current.deletingGroup?.id).toBe("g-1");
			expect(toastMock.error).not.toHaveBeenCalled();
		});

		it("confirms the delete, invalidates all three lists, and closes the dialog", async () => {
			trpcMocks.gameVariantListQueryFn.mockResolvedValue([]);
			trpcMocks.gameGroupDelete.mockResolvedValue({ success: true });
			const queryClient = createTestQueryClient();
			const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(queryClient),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onDeleteGroupRequest(result.current.groups[0].group);
			});
			await act(async () => {
				await result.current.onDeleteGroupConfirm();
			});
			expect(trpcMocks.gameGroupDelete).toHaveBeenCalledTimes(1);
			expect(trpcMocks.gameGroupDelete).toHaveBeenNthCalledWith(1, {
				id: "g-1",
			});
			expect(result.current.deletingGroup).toBeNull();
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ["gameGroup", "list"],
			});
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ["gameVariant", "list"],
			});
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ["gameMix", "list"],
			});
		});

		it("toasts a reassign-first message on a CONFLICT delete failure", async () => {
			trpcMocks.gameVariantListQueryFn.mockResolvedValue([]);
			trpcMocks.gameGroupDelete.mockRejectedValue(
				TRPCClientError.from({
					error: {
						code: -32_600,
						message: "This group is used by one or more game variants",
						data: { code: "CONFLICT", httpStatus: 409 },
					},
				})
			);
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onDeleteGroupRequest(result.current.groups[0].group);
			});
			await act(async () => {
				await result.current.onDeleteGroupConfirm();
			});
			await waitFor(() => {
				expect(toastMock.error).toHaveBeenCalledTimes(1);
			});
			expect(toastMock.error).toHaveBeenNthCalledWith(
				1,
				"Remove or reassign its variants first"
			);
			expect(result.current.deletingGroup).toBeNull();
		});

		it("toasts a generic message on a non-CONFLICT delete failure", async () => {
			trpcMocks.gameVariantListQueryFn.mockResolvedValue([]);
			trpcMocks.gameGroupDelete.mockRejectedValue(new Error("FORBIDDEN"));
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onDeleteGroupRequest(result.current.groups[0].group);
			});
			await act(async () => {
				await result.current.onDeleteGroupConfirm();
			});
			await waitFor(() => {
				expect(toastMock.error).toHaveBeenCalledTimes(1);
			});
			expect(toastMock.error).toHaveBeenNthCalledWith(
				1,
				"Failed to delete game group"
			);
			expect(result.current.deletingGroup).toBeNull();
		});

		it("does nothing when confirmed with no pending request", async () => {
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			await act(async () => {
				await result.current.onDeleteGroupConfirm();
			});
			expect(trpcMocks.gameGroupDelete).not.toHaveBeenCalled();
		});

		it("cancels a delete request without calling the mutation", async () => {
			trpcMocks.gameVariantListQueryFn.mockResolvedValue([]);
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onDeleteGroupRequest(result.current.groups[0].group);
			});
			act(() => {
				result.current.onDeleteGroupCancel();
			});
			expect(result.current.deletingGroup).toBeNull();
			expect(trpcMocks.gameGroupDelete).not.toHaveBeenCalled();
		});
	});

	describe("variant delete", () => {
		beforeEach(() => {
			// The suite-wide default mix (m-1) references v-1 (the default
			// variant), which would trip the mix-membership guard below for
			// every test in this block. Tests exercising that guard override
			// this back to a mix that references the variant.
			trpcMocks.gameMixListQueryFn.mockResolvedValue([]);
		});

		it("requests then confirms the delete, invalidating all three lists", async () => {
			trpcMocks.gameVariantDelete.mockResolvedValue({ success: true });
			const queryClient = createTestQueryClient();
			const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(queryClient),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onDeleteVariantRequest(
					result.current.groups[0].variants[0]
				);
			});
			expect(result.current.deletingVariant?.id).toBe("v-1");
			await act(async () => {
				await result.current.onDeleteVariantConfirm();
			});
			expect(trpcMocks.gameVariantDelete).toHaveBeenCalledTimes(1);
			expect(trpcMocks.gameVariantDelete).toHaveBeenNthCalledWith(1, {
				id: "v-1",
			});
			expect(result.current.deletingVariant).toBeNull();
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ["gameGroup", "list"],
			});
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ["gameVariant", "list"],
			});
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ["gameMix", "list"],
			});
		});

		it("does nothing when confirmed with no pending request", async () => {
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			await act(async () => {
				await result.current.onDeleteVariantConfirm();
			});
			expect(trpcMocks.gameVariantDelete).not.toHaveBeenCalled();
		});

		it("cancels a delete request without calling the mutation", async () => {
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onDeleteVariantRequest(
					result.current.groups[0].variants[0]
				);
			});
			act(() => {
				result.current.onDeleteVariantCancel();
			});
			expect(result.current.deletingVariant).toBeNull();
			expect(trpcMocks.gameVariantDelete).not.toHaveBeenCalled();
		});

		it("toasts and closes the dialog on delete failure", async () => {
			trpcMocks.gameVariantDelete.mockRejectedValue(new Error("FORBIDDEN"));
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onDeleteVariantRequest(
					result.current.groups[0].variants[0]
				);
			});
			await act(async () => {
				await result.current.onDeleteVariantConfirm();
			});
			await waitFor(() => {
				expect(toastMock.error).toHaveBeenCalledTimes(1);
			});
			expect(toastMock.error).toHaveBeenNthCalledWith(
				1,
				"Failed to delete game variant"
			);
			expect(result.current.deletingVariant).toBeNull();
		});

		it("toasts the mix-conflict message on a CONFLICT delete failure", async () => {
			trpcMocks.gameVariantDelete.mockRejectedValue(
				TRPCClientError.from({
					error: {
						code: -32_600,
						message:
							"This variant is used by a game mix. Remove it from the mix first.",
						data: { code: "CONFLICT", httpStatus: 409 },
					},
				})
			);
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onDeleteVariantRequest(
					result.current.groups[0].variants[0]
				);
			});
			await act(async () => {
				await result.current.onDeleteVariantConfirm();
			});
			await waitFor(() => {
				expect(toastMock.error).toHaveBeenCalledTimes(1);
			});
			expect(toastMock.error).toHaveBeenNthCalledWith(
				1,
				"This variant is used by a game mix. Remove it from the mix first."
			);
			expect(result.current.deletingVariant).toBeNull();
		});

		it("blocks the request and toasts when the variant is referenced by a mix, without opening the dialog", async () => {
			trpcMocks.gameMixListQueryFn.mockResolvedValue([
				mixRow({ games: ["v-1"] }),
			]);
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onDeleteVariantRequest(
					result.current.groups[0].variants[0]
				);
			});
			expect(toastMock.error).toHaveBeenCalledTimes(1);
			expect(toastMock.error).toHaveBeenNthCalledWith(
				1,
				"This variant is used by a game mix. Remove it from the mix first."
			);
			expect(result.current.deletingVariant).toBeNull();
			expect(trpcMocks.gameVariantDelete).not.toHaveBeenCalled();
		});

		it("opens the confirm dialog for a variant not referenced by any mix", async () => {
			// Suite-level beforeEach for this block already sets no mixes.
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onDeleteVariantRequest(
					result.current.groups[0].variants[0]
				);
			});
			expect(result.current.deletingVariant?.id).toBe("v-1");
			expect(toastMock.error).not.toHaveBeenCalled();
		});
	});

	describe("mix delete", () => {
		it("requests then confirms the delete, invalidating all three lists", async () => {
			trpcMocks.gameMixDelete.mockResolvedValue({ success: true });
			const queryClient = createTestQueryClient();
			const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(queryClient),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onDeleteMixRequest(result.current.mixes[0]);
			});
			expect(result.current.deletingMix?.id).toBe("m-1");
			await act(async () => {
				await result.current.onDeleteMixConfirm();
			});
			expect(trpcMocks.gameMixDelete).toHaveBeenCalledTimes(1);
			expect(trpcMocks.gameMixDelete).toHaveBeenNthCalledWith(1, {
				id: "m-1",
			});
			expect(result.current.deletingMix).toBeNull();
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ["gameGroup", "list"],
			});
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ["gameVariant", "list"],
			});
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ["gameMix", "list"],
			});
		});

		it("does nothing when confirmed with no pending request", async () => {
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			await act(async () => {
				await result.current.onDeleteMixConfirm();
			});
			expect(trpcMocks.gameMixDelete).not.toHaveBeenCalled();
		});

		it("cancels a delete request without calling the mutation", async () => {
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onDeleteMixRequest(result.current.mixes[0]);
			});
			act(() => {
				result.current.onDeleteMixCancel();
			});
			expect(result.current.deletingMix).toBeNull();
			expect(trpcMocks.gameMixDelete).not.toHaveBeenCalled();
		});

		it("toasts and closes the dialog on delete failure", async () => {
			trpcMocks.gameMixDelete.mockRejectedValue(new Error("FORBIDDEN"));
			const { result } = renderHook(() => useGamesPage(), {
				wrapper: withQueryClient(),
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			act(() => {
				result.current.onDeleteMixRequest(result.current.mixes[0]);
			});
			await act(async () => {
				await result.current.onDeleteMixConfirm();
			});
			await waitFor(() => {
				expect(toastMock.error).toHaveBeenCalledTimes(1);
			});
			expect(toastMock.error).toHaveBeenNthCalledWith(
				1,
				"Failed to delete game mix"
			);
			expect(result.current.deletingMix).toBeNull();
		});
	});
});
