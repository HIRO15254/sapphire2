import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
	navigate: vi.fn(),
	update: vi.fn(),
	del: vi.fn(),
	stores: [] as Array<{
		id: string;
		memo?: string | null;
		name: string;
		ringGameCount: number;
		tournamentCount: number;
	}>,
	isLoading: false,
	isUpdatePending: false,
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => hoisted.navigate,
}));

vi.mock("@/features/stores/hooks/use-stores", () => ({
	useStores: () => ({
		stores: hoisted.stores,
		isLoading: hoisted.isLoading,
		isUpdatePending: hoisted.isUpdatePending,
		isCreatePending: false,
		create: vi.fn(),
		update: hoisted.update,
		delete: hoisted.del,
	}),
}));

import { useStoreDetailPage } from "@/features/stores/pages/store-detail-page/use-store-detail-page";

const store = (id: string, name = "Akiba") => ({
	id,
	name,
	memo: null,
	ringGameCount: 0,
	tournamentCount: 0,
});

describe("useStoreDetailPage", () => {
	beforeEach(() => {
		hoisted.navigate.mockReset();
		hoisted.update.mockReset().mockResolvedValue({ id: "s1" });
		hoisted.del.mockReset();
		hoisted.stores = [];
		hoisted.isLoading = false;
		hoisted.isUpdatePending = false;
	});

	it("finds the store matching the id from the list", () => {
		hoisted.stores = [store("s1"), store("s2", "Shinjuku")];
		const { result } = renderHook(() => useStoreDetailPage("s2"));
		expect(result.current.store?.name).toBe("Shinjuku");
	});

	it("returns null store when the id is not in the list", () => {
		hoisted.stores = [store("s1")];
		const { result } = renderHook(() => useStoreDetailPage("missing"));
		expect(result.current.store).toBeNull();
	});

	it("forwards isLoading from the data hook", () => {
		hoisted.isLoading = true;
		const { result } = renderHook(() => useStoreDetailPage("s1"));
		expect(result.current.isLoading).toBe(true);
	});

	it("starts with all sheets/dialogs closed", () => {
		const { result } = renderHook(() => useStoreDetailPage("s1"));
		expect(result.current.isActionsOpen).toBe(false);
		expect(result.current.isEditOpen).toBe(false);
		expect(result.current.confirmingDelete).toBe(false);
	});

	it("openEditFromActions closes the drawer and opens the edit sheet", () => {
		const { result } = renderHook(() => useStoreDetailPage("s1"));
		act(() => result.current.setIsActionsOpen(true));
		act(() => result.current.openEditFromActions());
		expect(result.current.isActionsOpen).toBe(false);
		expect(result.current.isEditOpen).toBe(true);
	});

	it("openDeleteFromActions closes the drawer and opens the confirm dialog", () => {
		const { result } = renderHook(() => useStoreDetailPage("s1"));
		act(() => result.current.setIsActionsOpen(true));
		act(() => result.current.openDeleteFromActions());
		expect(result.current.isActionsOpen).toBe(false);
		expect(result.current.confirmingDelete).toBe(true);
	});

	it("handleEdit updates the store with the id and closes the sheet on success", async () => {
		const { result } = renderHook(() => useStoreDetailPage("s1"));
		act(() => result.current.setIsEditOpen(true));
		await act(async () => {
			result.current.handleEdit({ name: "Renamed", memo: "m" });
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(hoisted.update).toHaveBeenCalledWith({
			id: "s1",
			name: "Renamed",
			memo: "m",
		});
		await waitFor(() => expect(result.current.isEditOpen).toBe(false));
	});

	it("handleConfirmDelete deletes the store, closes the dialog, and navigates to /stores", () => {
		const { result } = renderHook(() => useStoreDetailPage("s1"));
		act(() => result.current.setConfirmingDelete(true));
		act(() => result.current.handleConfirmDelete());
		expect(hoisted.del).toHaveBeenCalledWith("s1");
		expect(result.current.confirmingDelete).toBe(false);
		expect(hoisted.navigate).toHaveBeenCalledWith({ to: "/stores" });
	});
});
