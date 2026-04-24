import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type BlockerStatus = "idle" | "blocked";

const mocks = vi.hoisted(() => ({
	device: "desktop" as "desktop" | "mobile",
	widgets: [] as Array<{ id: string; type: string }>,
	createWidget: vi.fn(),
	updateWidget: vi.fn(),
	deleteWidget: vi.fn(),
	isEditing: false,
	setEditing: vi.fn(),
	toggle: vi.fn(),
	enqueue: vi.fn(),
	flush: vi.fn(),
	discard: vi.fn(),
	hasPendingChanges: false,
	blockerStatus: "idle" as BlockerStatus,
	blockerProceed: vi.fn(),
	blockerReset: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useBlocker: () => ({
		status: mocks.blockerStatus,
		proceed: mocks.blockerProceed,
		reset: mocks.blockerReset,
	}),
}));

vi.mock("@/features/dashboard/components/edit-mode-toggle", () => ({
	useEditMode: () => ({
		isEditing: mocks.isEditing,
		setEditing: mocks.setEditing,
		toggle: mocks.toggle,
	}),
}));

vi.mock("@/features/dashboard/hooks/use-current-device", () => ({
	useCurrentDevice: () => mocks.device,
}));

vi.mock("@/features/dashboard/hooks/use-dashboard-widgets", () => ({
	useDashboardWidgets: () => ({
		widgets: mocks.widgets,
		isLoading: false,
		error: null,
		createWidget: mocks.createWidget,
		updateWidget: mocks.updateWidget,
		deleteWidget: mocks.deleteWidget,
	}),
}));

vi.mock("@/features/dashboard/hooks/use-layout-sync", () => ({
	useLayoutSync: () => ({
		enqueue: mocks.enqueue,
		flush: mocks.flush,
		discard: mocks.discard,
		hasPendingChanges: mocks.hasPendingChanges,
	}),
}));

import { useDashboardPage } from "@/routes/-use-dashboard-page";

describe("useDashboardPage", () => {
	beforeEach(() => {
		mocks.device = "desktop";
		mocks.widgets = [];
		mocks.createWidget.mockReset().mockResolvedValue(undefined);
		mocks.updateWidget.mockReset().mockResolvedValue(undefined);
		mocks.deleteWidget.mockReset().mockResolvedValue(undefined);
		mocks.isEditing = false;
		mocks.setEditing.mockReset();
		mocks.toggle.mockReset();
		mocks.enqueue.mockReset();
		mocks.flush.mockReset().mockResolvedValue(undefined);
		mocks.discard.mockReset();
		mocks.hasPendingChanges = false;
		mocks.blockerStatus = "idle";
		mocks.blockerProceed.mockReset();
		mocks.blockerReset.mockReset();
	});

	describe("initial state", () => {
		it("surfaces device, widgets, and editing state from inner hooks", () => {
			mocks.widgets = [{ id: "w1", type: "summary_stats" }];
			const { result } = renderHook(() => useDashboardPage());
			expect(result.current.device).toBe("desktop");
			expect(result.current.widgets).toEqual(mocks.widgets);
			expect(result.current.isEditing).toBe(false);
			expect(result.current.editingWidget).toBeNull();
			expect(result.current.deletingWidget).toBeNull();
			expect(result.current.containerWidth).toBe(0);
		});
	});

	describe("handleLayoutChange", () => {
		it("maps the layout array into LayoutItem and forwards to enqueue", () => {
			const { result } = renderHook(() => useDashboardPage());
			act(() => {
				result.current.handleLayoutChange([
					{ i: "w1", x: 0, y: 0, w: 2, h: 2 } as never,
					{ i: "w2", x: 2, y: 0, w: 3, h: 4 } as never,
				]);
			});
			expect(mocks.enqueue).toHaveBeenCalledWith([
				{ id: "w1", x: 0, y: 0, w: 2, h: 2 },
				{ id: "w2", x: 2, y: 0, w: 3, h: 4 },
			]);
		});
	});

	describe("handleDoneClick", () => {
		it("toggles edit mode when not currently editing", async () => {
			mocks.isEditing = false;
			const { result } = renderHook(() => useDashboardPage());
			await act(async () => {
				await result.current.handleDoneClick();
			});
			expect(mocks.toggle).toHaveBeenCalledOnce();
			expect(mocks.flush).not.toHaveBeenCalled();
		});

		it("flushes pending + leaves edit mode when currently editing", async () => {
			mocks.isEditing = true;
			const { result } = renderHook(() => useDashboardPage());
			await act(async () => {
				await result.current.handleDoneClick();
			});
			expect(mocks.flush).toHaveBeenCalledOnce();
			expect(mocks.setEditing).toHaveBeenCalledWith(false);
			expect(mocks.toggle).not.toHaveBeenCalled();
		});
	});

	describe("handleAdd", () => {
		it("flushes pending changes then creates the new widget", async () => {
			const order: string[] = [];
			mocks.flush.mockImplementation(() => {
				order.push("flush");
				return Promise.resolve();
			});
			mocks.createWidget.mockImplementation(() => {
				order.push("create");
				return Promise.resolve();
			});
			const { result } = renderHook(() => useDashboardPage());
			await act(async () => {
				await result.current.handleAdd("summary_stats");
			});
			expect(order).toEqual(["flush", "create"]);
			expect(mocks.createWidget).toHaveBeenCalledWith({
				type: "summary_stats",
			});
		});
	});

	describe("handleEditSave", () => {
		it("is a no-op when editingWidget is null", async () => {
			const { result } = renderHook(() => useDashboardPage());
			await act(async () => {
				await result.current.handleEditSave({ foo: "bar" });
			});
			expect(mocks.updateWidget).not.toHaveBeenCalled();
		});

		it("calls updateWidget with id + new config when a widget is being edited", async () => {
			const { result } = renderHook(() => useDashboardPage());
			act(() => {
				result.current.setEditingWidget({
					id: "w1",
					type: "summary_stats",
				} as never);
			});
			await act(async () => {
				await result.current.handleEditSave({ foo: "bar" });
			});
			expect(mocks.updateWidget).toHaveBeenCalledWith({
				id: "w1",
				config: { foo: "bar" },
			});
		});
	});

	describe("handleDelete", () => {
		it("is a no-op when deletingWidget is null", async () => {
			const { result } = renderHook(() => useDashboardPage());
			await act(async () => {
				await result.current.handleDelete();
			});
			expect(mocks.deleteWidget).not.toHaveBeenCalled();
		});

		it("flushes then deletes and clears deletingWidget", async () => {
			const order: string[] = [];
			mocks.flush.mockImplementation(() => {
				order.push("flush");
				return Promise.resolve();
			});
			mocks.deleteWidget.mockImplementation(() => {
				order.push("delete");
				return Promise.resolve();
			});
			const { result } = renderHook(() => useDashboardPage());
			act(() => {
				result.current.setDeletingWidget({ id: "w-del" } as never);
			});
			await act(async () => {
				await result.current.handleDelete();
			});
			expect(order).toEqual(["flush", "delete"]);
			expect(mocks.deleteWidget).toHaveBeenCalledWith("w-del");
			await waitFor(() => expect(result.current.deletingWidget).toBeNull());
		});
	});

	describe("blocker handlers", () => {
		it("handleBlockerSave no-ops when blocker.status is idle", async () => {
			mocks.blockerStatus = "idle";
			const { result } = renderHook(() => useDashboardPage());
			await act(async () => {
				await result.current.handleBlockerSave();
			});
			expect(mocks.flush).not.toHaveBeenCalled();
			expect(mocks.blockerProceed).not.toHaveBeenCalled();
		});

		it("handleBlockerSave flushes and proceeds when blocked", async () => {
			mocks.blockerStatus = "blocked";
			const order: string[] = [];
			mocks.flush.mockImplementation(() => {
				order.push("flush");
				return Promise.resolve();
			});
			mocks.blockerProceed.mockImplementation(() => {
				order.push("proceed");
			});
			const { result } = renderHook(() => useDashboardPage());
			await act(async () => {
				await result.current.handleBlockerSave();
			});
			expect(order).toEqual(["flush", "proceed"]);
		});

		it("handleBlockerDiscard no-ops when status is idle", () => {
			mocks.blockerStatus = "idle";
			const { result } = renderHook(() => useDashboardPage());
			act(() => {
				result.current.handleBlockerDiscard();
			});
			expect(mocks.discard).not.toHaveBeenCalled();
			expect(mocks.blockerProceed).not.toHaveBeenCalled();
		});

		it("handleBlockerDiscard calls discard then proceed when blocked", () => {
			mocks.blockerStatus = "blocked";
			const order: string[] = [];
			mocks.discard.mockImplementation(() => {
				order.push("discard");
			});
			mocks.blockerProceed.mockImplementation(() => {
				order.push("proceed");
			});
			const { result } = renderHook(() => useDashboardPage());
			act(() => {
				result.current.handleBlockerDiscard();
			});
			expect(order).toEqual(["discard", "proceed"]);
		});

		it("handleBlockerCancel calls blocker.reset only when blocked", () => {
			mocks.blockerStatus = "idle";
			const { result } = renderHook(() => useDashboardPage());
			act(() => {
				result.current.handleBlockerCancel();
			});
			expect(mocks.blockerReset).not.toHaveBeenCalled();
		});

		it("handleBlockerCancel calls blocker.reset when blocked", () => {
			mocks.blockerStatus = "blocked";
			const { result } = renderHook(() => useDashboardPage());
			act(() => {
				result.current.handleBlockerCancel();
			});
			expect(mocks.blockerReset).toHaveBeenCalledOnce();
		});
	});

	describe("dialog open-change handlers", () => {
		it("handleDeletingWidgetDialogChange clears deletingWidget when closing", () => {
			const { result } = renderHook(() => useDashboardPage());
			act(() => {
				result.current.setDeletingWidget({ id: "w" } as never);
			});
			act(() => {
				result.current.handleDeletingWidgetDialogChange(false);
			});
			expect(result.current.deletingWidget).toBeNull();
		});

		it("handleDeletingWidgetDialogChange leaves state intact when opening", () => {
			const { result } = renderHook(() => useDashboardPage());
			act(() => {
				result.current.setDeletingWidget({ id: "w" } as never);
			});
			act(() => {
				result.current.handleDeletingWidgetDialogChange(true);
			});
			expect(result.current.deletingWidget).not.toBeNull();
		});

		it("handleEditingWidgetDialogChange clears editingWidget when closing", () => {
			const { result } = renderHook(() => useDashboardPage());
			act(() => {
				result.current.setEditingWidget({ id: "w" } as never);
			});
			act(() => {
				result.current.handleEditingWidgetDialogChange(false);
			});
			expect(result.current.editingWidget).toBeNull();
		});

		it("handleEditingWidgetDialogChange leaves state intact when opening", () => {
			const { result } = renderHook(() => useDashboardPage());
			act(() => {
				result.current.setEditingWidget({ id: "w" } as never);
			});
			act(() => {
				result.current.handleEditingWidgetDialogChange(true);
			});
			expect(result.current.editingWidget).not.toBeNull();
		});
	});
});
