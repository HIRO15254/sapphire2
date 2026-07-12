import { act, renderHook, waitFor } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, withQueryClient } from "@/__tests__/test-utils";

const trpcMocks = vi.hoisted(() => ({
	gameGroupListQueryFn: vi.fn(),
	gameGroupCreate: vi.fn(),
	gameGroupUpdate: vi.fn(),
	gameGroupDelete: vi.fn(),
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
				}),
			},
		},
	},
	trpcClient: {
		gameGroup: {
			create: { mutate: trpcMocks.gameGroupCreate },
			update: { mutate: trpcMocks.gameGroupUpdate },
			delete: { mutate: trpcMocks.gameGroupDelete },
		},
	},
}));

vi.mock("sonner", () => ({ toast: toastMock }));

import { useGameGroupsSection } from "../use-game-groups-section";

function groupRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "g-1",
		userId: "u-1",
		builtinKey: "nlh",
		label: "No Limit Hold'em",
		blind1Label: "Small blind",
		blind2Label: "Big blind",
		blind3Label: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

describe("useGameGroupsSection", () => {
	beforeEach(() => {
		trpcMocks.gameGroupListQueryFn.mockReset();
		trpcMocks.gameGroupListQueryFn.mockResolvedValue([groupRow()]);
		trpcMocks.gameGroupCreate.mockReset();
		trpcMocks.gameGroupUpdate.mockReset();
		trpcMocks.gameGroupDelete.mockReset();
		toastMock.error.mockReset();
	});

	it("exposes the user's game groups with a slot-labels summary once loaded", async () => {
		const { result } = renderHook(() => useGameGroupsSection(), {
			wrapper: withQueryClient(),
		});
		expect(result.current.isLoading).toBe(true);
		await waitFor(() => {
			expect(result.current.groups).toHaveLength(1);
		});
		expect(result.current.groups[0]).toMatchObject({
			id: "g-1",
			label: "No Limit Hold'em",
			builtinKey: "nlh",
			slotSummary: "Small blind / Big blind",
		});
		expect(result.current.isLoading).toBe(false);
	});

	it("summarizes an all-null group as 'Default labels'", async () => {
		trpcMocks.gameGroupListQueryFn.mockResolvedValue([
			groupRow({ blind1Label: null, blind2Label: null, blind3Label: null }),
		]);
		const { result } = renderHook(() => useGameGroupsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.groups).toHaveLength(1));
		expect(result.current.groups[0].slotSummary).toBe("Default labels");
	});

	it("opens the create sheet blank when Add is triggered", async () => {
		const { result } = renderHook(() => useGameGroupsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.groups).toHaveLength(1));
		act(() => {
			result.current.onAdd();
		});
		expect(result.current.isFormOpen).toBe(true);
		expect(result.current.formTitle).toBe("Add game group");
		expect(result.current.form.state.values).toEqual({
			label: "",
			blind1Label: "",
			blind2Label: "",
			blind3Label: "",
		});
	});

	it("submits the create form with trimmed values, closes the sheet, and invalidates both lists", async () => {
		trpcMocks.gameGroupCreate.mockResolvedValue(groupRow({ id: "g-2" }));
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = renderHook(() => useGameGroupsSection(), {
			wrapper: withQueryClient(queryClient),
		});
		await waitFor(() => expect(result.current.groups).toHaveLength(1));
		act(() => {
			result.current.onAdd();
		});
		act(() => {
			result.current.form.setFieldValue("label", " Short Deck ");
			result.current.form.setFieldValue("blind1Label", " Ante ");
			result.current.form.setFieldValue("blind2Label", "");
			result.current.form.setFieldValue("blind3Label", "");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		await waitFor(() => {
			expect(result.current.isFormOpen).toBe(false);
		});
		expect(trpcMocks.gameGroupCreate).toHaveBeenCalledTimes(1);
		expect(trpcMocks.gameGroupCreate).toHaveBeenNthCalledWith(1, {
			label: "Short Deck",
			blind1Label: "Ante",
			blind2Label: null,
			blind3Label: null,
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ["gameGroup", "list"],
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ["gameVariant", "list"],
		});
	});

	it("toasts and keeps the sheet open on create failure", async () => {
		trpcMocks.gameGroupCreate.mockRejectedValue(new Error("CONFLICT"));
		const { result } = renderHook(() => useGameGroupsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.groups).toHaveLength(1));
		act(() => {
			result.current.onAdd();
		});
		act(() => {
			result.current.form.setFieldValue("label", "Short Deck");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		await waitFor(() => {
			expect(toastMock.error).toHaveBeenCalledTimes(1);
		});
		expect(toastMock.error).toHaveBeenNthCalledWith(
			1,
			"Failed to create game group"
		);
		expect(result.current.isFormOpen).toBe(true);
	});

	it("blocks a create submit with a blank label", async () => {
		const { result } = renderHook(() => useGameGroupsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.groups).toHaveLength(1));
		act(() => {
			result.current.onAdd();
		});
		act(() => {
			result.current.form.setFieldValue("label", "   ");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(trpcMocks.gameGroupCreate).not.toHaveBeenCalled();
	});

	it("opens the edit sheet seeded with the picked group's fields", async () => {
		const { result } = renderHook(() => useGameGroupsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.groups).toHaveLength(1));
		act(() => {
			result.current.onEdit(result.current.groups[0]);
		});
		expect(result.current.formTitle).toBe("Edit game group");
		expect(result.current.form.state.values).toEqual({
			label: "No Limit Hold'em",
			blind1Label: "Small blind",
			blind2Label: "Big blind",
			blind3Label: "",
		});
	});

	it("submits the edit form with trimmed values and closes the sheet", async () => {
		trpcMocks.gameGroupUpdate.mockResolvedValue(groupRow());
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = renderHook(() => useGameGroupsSection(), {
			wrapper: withQueryClient(queryClient),
		});
		await waitFor(() => expect(result.current.groups).toHaveLength(1));
		act(() => {
			result.current.onEdit(result.current.groups[0]);
		});
		act(() => {
			result.current.form.setFieldValue("label", " Hold'em Variants ");
			result.current.form.setFieldValue("blind3Label", " Straddle ");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		await waitFor(() => {
			expect(result.current.isFormOpen).toBe(false);
		});
		expect(trpcMocks.gameGroupUpdate).toHaveBeenCalledTimes(1);
		expect(trpcMocks.gameGroupUpdate).toHaveBeenNthCalledWith(1, {
			id: "g-1",
			label: "Hold'em Variants",
			blind1Label: "Small blind",
			blind2Label: "Big blind",
			blind3Label: "Straddle",
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ["gameGroup", "list"],
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ["gameVariant", "list"],
		});
	});

	it("toasts and keeps the sheet open on update failure", async () => {
		trpcMocks.gameGroupUpdate.mockRejectedValue(new Error("CONFLICT"));
		const { result } = renderHook(() => useGameGroupsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.groups).toHaveLength(1));
		act(() => {
			result.current.onEdit(result.current.groups[0]);
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		await waitFor(() => {
			expect(toastMock.error).toHaveBeenCalledTimes(1);
		});
		expect(toastMock.error).toHaveBeenNthCalledWith(
			1,
			"Failed to update game group"
		);
		expect(result.current.isFormOpen).toBe(true);
	});

	it("blocks an edit submit with a blank label", async () => {
		const { result } = renderHook(() => useGameGroupsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.groups).toHaveLength(1));
		act(() => {
			result.current.onEdit(result.current.groups[0]);
		});
		act(() => {
			result.current.form.setFieldValue("label", "   ");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(trpcMocks.gameGroupUpdate).not.toHaveBeenCalled();
	});

	it("closes the sheet and resets the form when open is set to false", async () => {
		const { result } = renderHook(() => useGameGroupsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.groups).toHaveLength(1));
		act(() => {
			result.current.onEdit(result.current.groups[0]);
		});
		act(() => {
			result.current.onFormOpenChange(false);
		});
		expect(result.current.isFormOpen).toBe(false);
		expect(result.current.form.state.values.label).toBe("");
	});

	it("deletes after confirmation and invalidates the group list only", async () => {
		trpcMocks.gameGroupDelete.mockResolvedValue({ success: true });
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = renderHook(() => useGameGroupsSection(), {
			wrapper: withQueryClient(queryClient),
		});
		await waitFor(() => expect(result.current.groups).toHaveLength(1));
		act(() => {
			result.current.onDeleteRequest(result.current.groups[0]);
		});
		expect(result.current.deletingGroup?.id).toBe("g-1");
		await act(async () => {
			await result.current.onDeleteConfirm();
		});
		expect(trpcMocks.gameGroupDelete).toHaveBeenCalledTimes(1);
		expect(trpcMocks.gameGroupDelete).toHaveBeenNthCalledWith(1, { id: "g-1" });
		expect(result.current.deletingGroup).toBeNull();
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ["gameGroup", "list"],
		});
		expect(invalidateSpy).not.toHaveBeenCalledWith({
			queryKey: ["gameVariant", "list"],
		});
	});

	it("does nothing when delete is confirmed with no pending request", async () => {
		const { result } = renderHook(() => useGameGroupsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.groups).toHaveLength(1));
		await act(async () => {
			await result.current.onDeleteConfirm();
		});
		expect(trpcMocks.gameGroupDelete).not.toHaveBeenCalled();
	});

	it("cancels a delete request without calling the mutation", async () => {
		const { result } = renderHook(() => useGameGroupsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.groups).toHaveLength(1));
		act(() => {
			result.current.onDeleteRequest(result.current.groups[0]);
		});
		act(() => {
			result.current.onDeleteCancel();
		});
		expect(result.current.deletingGroup).toBeNull();
		expect(trpcMocks.gameGroupDelete).not.toHaveBeenCalled();
	});

	it("toasts a reassign-first message on a CONFLICT delete failure", async () => {
		trpcMocks.gameGroupDelete.mockRejectedValue(
			TRPCClientError.from({
				error: {
					code: -32_600,
					message: "This group is used by one or more game variants",
					data: { code: "CONFLICT", httpStatus: 409 },
				},
			})
		);
		const { result } = renderHook(() => useGameGroupsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.groups).toHaveLength(1));
		act(() => {
			result.current.onDeleteRequest(result.current.groups[0]);
		});
		await act(async () => {
			await result.current.onDeleteConfirm();
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
		trpcMocks.gameGroupDelete.mockRejectedValue(new Error("FORBIDDEN"));
		const { result } = renderHook(() => useGameGroupsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.groups).toHaveLength(1));
		act(() => {
			result.current.onDeleteRequest(result.current.groups[0]);
		});
		await act(async () => {
			await result.current.onDeleteConfirm();
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
});
