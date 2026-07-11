import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, withQueryClient } from "@/__tests__/test-utils";

const trpcMocks = vi.hoisted(() => ({
	gameVariantListQueryFn: vi.fn(),
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
	},
	trpcClient: {
		gameVariant: {
			update: { mutate: trpcMocks.gameVariantUpdate },
			delete: { mutate: trpcMocks.gameVariantDelete },
		},
	},
}));

vi.mock("sonner", () => ({ toast: toastMock }));

import { useCustomVariantsSection } from "../use-custom-variants-section";

function variantRow(overrides: Record<string, unknown> = {}) {
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

describe("useCustomVariantsSection", () => {
	beforeEach(() => {
		trpcMocks.gameVariantListQueryFn.mockReset();
		trpcMocks.gameVariantListQueryFn.mockResolvedValue([variantRow()]);
		trpcMocks.gameVariantUpdate.mockReset();
		trpcMocks.gameVariantDelete.mockReset();
		toastMock.error.mockReset();
	});

	it("exposes the user's custom variants once loaded", async () => {
		const { result } = renderHook(() => useCustomVariantsSection(), {
			wrapper: withQueryClient(),
		});
		expect(result.current.isLoading).toBe(true);
		await waitFor(() => {
			expect(result.current.variants.map((v) => v.label)).toEqual(["Big Duck"]);
		});
		expect(result.current.isLoading).toBe(false);
	});

	it("opens the edit sheet seeded with the picked variant's fields", async () => {
		const { result } = renderHook(() => useCustomVariantsSection(), {
			wrapper: withQueryClient(),
		});
		await waitFor(() => expect(result.current.variants).toHaveLength(1));
		act(() => {
			result.current.onEdit(result.current.variants[0]);
		});
		expect(result.current.editingVariant?.id).toBe("cv-1");
		expect(result.current.form.state.values).toEqual({
			label: "Big Duck",
			blind1Label: "Button",
			blind2Label: "",
			blind3Label: "Cap",
		});
	});

	it("submits the edit as an update with trimmed values and closes the sheet", async () => {
		trpcMocks.gameVariantUpdate.mockResolvedValue(variantRow());
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = renderHook(() => useCustomVariantsSection(), {
			wrapper: withQueryClient(queryClient),
		});
		await waitFor(() => expect(result.current.variants).toHaveLength(1));
		act(() => {
			result.current.onEdit(result.current.variants[0]);
		});
		act(() => {
			result.current.form.setFieldValue("label", " Small Duck ");
			result.current.form.setFieldValue("blind3Label", "");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		await waitFor(() => {
			expect(result.current.editingVariant).toBeNull();
		});
		expect(trpcMocks.gameVariantUpdate).toHaveBeenCalledTimes(1);
		expect(trpcMocks.gameVariantUpdate).toHaveBeenNthCalledWith(1, {
			id: "cv-1",
			label: "Small Duck",
			blind1Label: "Button",
			blind2Label: null,
			blind3Label: null,
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ["gameVariant", "list"],
		});
	});

	it("keeps the edit sheet open and toasts on update failure", async () => {
		trpcMocks.gameVariantUpdate.mockRejectedValue(new Error("CONFLICT"));
		const { result } = renderHook(() => useCustomVariantsSection(), {
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
		expect(result.current.editingVariant?.id).toBe("cv-1");
	});

	it("blocks an edit submit with a blank label", async () => {
		const { result } = renderHook(() => useCustomVariantsSection(), {
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

	it("deletes after confirmation and closes the dialog", async () => {
		trpcMocks.gameVariantDelete.mockResolvedValue({ success: true });
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = renderHook(() => useCustomVariantsSection(), {
			wrapper: withQueryClient(queryClient),
		});
		await waitFor(() => expect(result.current.variants).toHaveLength(1));
		act(() => {
			result.current.onDeleteRequest(result.current.variants[0]);
		});
		expect(result.current.deletingVariant?.id).toBe("cv-1");
		await act(async () => {
			await result.current.onDeleteConfirm();
		});
		expect(trpcMocks.gameVariantDelete).toHaveBeenCalledTimes(1);
		expect(trpcMocks.gameVariantDelete).toHaveBeenNthCalledWith(1, {
			id: "cv-1",
		});
		expect(result.current.deletingVariant).toBeNull();
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ["gameVariant", "list"],
		});
	});

	it("toasts and closes the dialog on delete failure", async () => {
		trpcMocks.gameVariantDelete.mockRejectedValue(new Error("FORBIDDEN"));
		const { result } = renderHook(() => useCustomVariantsSection(), {
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
		expect(result.current.deletingVariant).toBeNull();
	});
});
