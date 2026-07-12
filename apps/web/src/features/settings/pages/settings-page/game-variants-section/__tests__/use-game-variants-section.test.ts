import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, withQueryClient } from "@/__tests__/test-utils";

const trpcMocks = vi.hoisted(() => ({
	gameVariantListQueryFn: vi.fn(),
	gameGroupListQueryFn: vi.fn(),
	gameVariantUpdate: vi.fn(),
	gameVariantDelete: vi.fn(),
}));

const toastMock = vi.hoisted(() => ({
	error: vi.fn(),
	success: vi.fn(),
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
		gameGroup: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameGroup", "list"],
					queryFn: () => trpcMocks.gameGroupListQueryFn(),
				}),
			},
		},
	},
	trpcClient: {
		gameVariant: {
			update: { mutate: trpcMocks.gameVariantUpdate },
			delete: { mutate: trpcMocks.gameVariantDelete },
		},
	},
}));

vi.mock("sonner", () => ({ toast: toastMock }));

import { useGameVariantsSection } from "../use-game-variants-section";

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

describe("useGameVariantsSection", () => {
	beforeEach(() => {
		trpcMocks.gameVariantListQueryFn.mockReset();
		trpcMocks.gameVariantListQueryFn.mockResolvedValue([variantRow()]);
		trpcMocks.gameGroupListQueryFn.mockReset();
		trpcMocks.gameGroupListQueryFn.mockResolvedValue([groupRow()]);
		trpcMocks.gameVariantUpdate.mockReset();
		trpcMocks.gameVariantDelete.mockReset();
		toastMock.error.mockReset();
	});

	it("exposes the user's game variants with resolved group labels once loaded", async () => {
		const { result } = renderHook(() => useGameVariantsSection(), {
			wrapper: withQueryClient(),
		});
		expect(result.current.isLoading).toBe(true);
		await waitFor(() => {
			expect(result.current.variants).toHaveLength(1);
		});
		expect(result.current.variants[0]).toMatchObject({
			id: "v-1",
			label: "Big Duck",
			shortLabel: "BD",
			builtinKey: null,
			groupId: "g-1",
			groupLabel: "No Limit Hold'em",
		});
		expect(result.current.isLoading).toBe(false);
	});

	it("exposes the group options for the edit select", async () => {
		const { result } = renderHook(() => useGameVariantsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.variants).toHaveLength(1));
		expect(result.current.groups).toEqual([
			{ id: "g-1", label: "No Limit Hold'em" },
		]);
	});

	it("falls back to 'Unknown group' when the referenced group is missing", async () => {
		trpcMocks.gameVariantListQueryFn.mockResolvedValue([
			variantRow({ groupId: "missing-group" }),
		]);
		const { result } = renderHook(() => useGameVariantsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.variants).toHaveLength(1));
		expect(result.current.variants[0].groupLabel).toBe("Unknown group");
	});

	it("opens the edit sheet seeded with the picked variant's fields", async () => {
		const { result } = renderHook(() => useGameVariantsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.variants).toHaveLength(1));
		act(() => {
			result.current.onEdit(result.current.variants[0]);
		});
		expect(result.current.editingVariant?.id).toBe("v-1");
		expect(result.current.form.state.values).toEqual({
			label: "Big Duck",
			shortLabel: "BD",
			groupId: "g-1",
		});
	});

	it("seeds a blank short label when the variant has none", async () => {
		trpcMocks.gameVariantListQueryFn.mockResolvedValue([
			variantRow({ shortLabel: null }),
		]);
		const { result } = renderHook(() => useGameVariantsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.variants).toHaveLength(1));
		act(() => {
			result.current.onEdit(result.current.variants[0]);
		});
		expect(result.current.form.state.values.shortLabel).toBe("");
	});

	it("submits the edit as an update with trimmed values and closes the sheet", async () => {
		trpcMocks.gameVariantUpdate.mockResolvedValue(variantRow());
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = renderHook(() => useGameVariantsSection(), {
			wrapper: withQueryClient(queryClient),
		});
		await waitFor(() => expect(result.current.variants).toHaveLength(1));
		act(() => {
			result.current.onEdit(result.current.variants[0]);
		});
		act(() => {
			result.current.form.setFieldValue("label", " Big Duck NL ");
			result.current.form.setFieldValue("shortLabel", "  ");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		await waitFor(() => {
			expect(result.current.editingVariant).toBeNull();
		});
		expect(trpcMocks.gameVariantUpdate).toHaveBeenCalledTimes(1);
		expect(trpcMocks.gameVariantUpdate).toHaveBeenNthCalledWith(1, {
			id: "v-1",
			label: "Big Duck NL",
			shortLabel: null,
			groupId: "g-1",
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ["gameVariant", "list"],
		});
	});

	it("submits a re-group edit, sending the newly selected groupId", async () => {
		trpcMocks.gameGroupListQueryFn.mockResolvedValue([
			groupRow(),
			groupRow({ id: "g-2", builtinKey: null, label: "Stud" }),
		]);
		trpcMocks.gameVariantUpdate.mockResolvedValue(
			variantRow({ groupId: "g-2" })
		);
		const { result } = renderHook(() => useGameVariantsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.variants).toHaveLength(1));
		act(() => {
			result.current.onEdit(result.current.variants[0]);
		});
		act(() => {
			result.current.form.setFieldValue("groupId", "g-2");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(trpcMocks.gameVariantUpdate).toHaveBeenNthCalledWith(1, {
			id: "v-1",
			label: "Big Duck",
			shortLabel: "BD",
			groupId: "g-2",
		});
	});

	it("keeps the edit sheet open and toasts on update failure", async () => {
		trpcMocks.gameVariantUpdate.mockRejectedValue(new Error("CONFLICT"));
		const { result } = renderHook(() => useGameVariantsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.variants).toHaveLength(1));
		act(() => {
			result.current.onEdit(result.current.variants[0]);
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		await waitFor(() => {
			expect(toastMock.error).toHaveBeenCalledTimes(1);
		});
		expect(toastMock.error).toHaveBeenNthCalledWith(
			1,
			"Failed to update game variant"
		);
		expect(result.current.editingVariant?.id).toBe("v-1");
	});

	it("blocks an edit submit with a blank label", async () => {
		const { result } = renderHook(() => useGameVariantsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.variants).toHaveLength(1));
		act(() => {
			result.current.onEdit(result.current.variants[0]);
		});
		act(() => {
			result.current.form.setFieldValue("label", "   ");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(trpcMocks.gameVariantUpdate).not.toHaveBeenCalled();
	});

	it("closes the edit sheet and resets the form when open is set to false", async () => {
		const { result } = renderHook(() => useGameVariantsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.variants).toHaveLength(1));
		act(() => {
			result.current.onEdit(result.current.variants[0]);
		});
		act(() => {
			result.current.onEditOpenChange(false);
		});
		expect(result.current.editingVariant).toBeNull();
		expect(result.current.form.state.values.label).toBe("");
	});

	it("deletes after confirmation and closes the dialog", async () => {
		trpcMocks.gameVariantDelete.mockResolvedValue({ success: true });
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = renderHook(() => useGameVariantsSection(), {
			wrapper: withQueryClient(queryClient),
		});
		await waitFor(() => expect(result.current.variants).toHaveLength(1));
		act(() => {
			result.current.onDeleteRequest(result.current.variants[0]);
		});
		expect(result.current.deletingVariant?.id).toBe("v-1");
		await act(async () => {
			await result.current.onDeleteConfirm();
		});
		expect(trpcMocks.gameVariantDelete).toHaveBeenCalledTimes(1);
		expect(trpcMocks.gameVariantDelete).toHaveBeenNthCalledWith(1, {
			id: "v-1",
		});
		expect(result.current.deletingVariant).toBeNull();
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ["gameVariant", "list"],
		});
	});

	it("does nothing when delete is confirmed with no pending request", async () => {
		const { result } = renderHook(() => useGameVariantsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.variants).toHaveLength(1));
		await act(async () => {
			await result.current.onDeleteConfirm();
		});
		expect(trpcMocks.gameVariantDelete).not.toHaveBeenCalled();
	});

	it("cancels a delete request without calling the mutation", async () => {
		const { result } = renderHook(() => useGameVariantsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.variants).toHaveLength(1));
		act(() => {
			result.current.onDeleteRequest(result.current.variants[0]);
		});
		act(() => {
			result.current.onDeleteCancel();
		});
		expect(result.current.deletingVariant).toBeNull();
		expect(trpcMocks.gameVariantDelete).not.toHaveBeenCalled();
	});

	it("toasts and closes the dialog on delete failure", async () => {
		trpcMocks.gameVariantDelete.mockRejectedValue(new Error("FORBIDDEN"));
		const { result } = renderHook(() => useGameVariantsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.variants).toHaveLength(1));
		act(() => {
			result.current.onDeleteRequest(result.current.variants[0]);
		});
		await act(async () => {
			await result.current.onDeleteConfirm();
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
});
