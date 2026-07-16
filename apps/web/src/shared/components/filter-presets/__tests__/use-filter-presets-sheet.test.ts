import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
	useFilterPresets: vi.fn(),
	create: vi.fn(),
	remove: vi.fn(),
	setDefault: vi.fn(),
	clearDefault: vi.fn(),
}));

vi.mock("@/shared/hooks/use-filter-presets", () => ({
	useFilterPresets: hoisted.useFilterPresets,
}));

import { useFilterPresetsSheet } from "@/shared/components/filter-presets/use-filter-presets-sheet";
import type { FilterPresetItem } from "@/shared/hooks/use-filter-presets";

function makePreset(
	overrides: Partial<FilterPresetItem> = {}
): FilterPresetItem {
	return {
		id: "p1",
		userId: "u1",
		screenKey: "sessions",
		name: "My preset",
		payload: { period: "last_7_days" },
		isDefault: false,
		createdAt: "2024-01-01T00:00:00.000Z",
		updatedAt: "2024-01-01T00:00:00.000Z",
		...overrides,
	};
}

function presetsStub(overrides: Partial<ReturnType<typeof baseStub>> = {}) {
	return { ...baseStub(), ...overrides };
}

function baseStub() {
	return {
		presets: [] as FilterPresetItem[],
		defaultPreset: null as FilterPresetItem | null,
		isLoading: false,
		isCreatePending: false,
		isDeletePending: false,
		isSetDefaultPending: false,
		create: hoisted.create,
		remove: hoisted.remove,
		setDefault: hoisted.setDefault,
		clearDefault: hoisted.clearDefault,
	};
}

const currentPayload = { period: "this_month" };

describe("useFilterPresetsSheet", () => {
	beforeEach(() => {
		for (const m of [
			hoisted.create,
			hoisted.remove,
			hoisted.setDefault,
			hoisted.clearDefault,
		]) {
			m.mockReset();
		}
		hoisted.useFilterPresets.mockReturnValue(presetsStub());
	});

	function renderSheet(
		overrides: Partial<{
			onApply: (payload: unknown) => void;
			onOpenChange: (open: boolean) => void;
		}> = {}
	) {
		const onApply = overrides.onApply ?? vi.fn();
		const onOpenChange = overrides.onOpenChange ?? vi.fn();
		const view = renderHook(() =>
			useFilterPresetsSheet({
				screenKey: "sessions",
				currentPayload,
				onApply,
				onOpenChange,
			})
		);
		return { ...view, onApply, onOpenChange };
	}

	it("starts on the 'saved' tab with no pending delete", () => {
		const { result } = renderSheet();
		expect(result.current.activeTab).toBe("saved");
		expect(result.current.pendingDelete).toBeNull();
	});

	it("forwards presets/defaultPreset/isLoading and pending flags from useFilterPresets", () => {
		const preset = makePreset({ isDefault: true });
		hoisted.useFilterPresets.mockReturnValue(
			presetsStub({
				presets: [preset],
				defaultPreset: preset,
				isLoading: true,
				isCreatePending: true,
				isDeletePending: true,
				isSetDefaultPending: true,
			})
		);
		const { result } = renderSheet();
		expect(result.current.presets).toEqual([preset]);
		expect(result.current.defaultPreset).toEqual(preset);
		expect(result.current.isLoading).toBe(true);
		expect(result.current.isCreatePending).toBe(true);
		expect(result.current.isDeletePending).toBe(true);
		expect(result.current.isSetDefaultPending).toBe(true);
	});

	it("calls useFilterPresets with the given screenKey", () => {
		renderSheet();
		expect(hoisted.useFilterPresets).toHaveBeenCalledWith("sessions");
		for (const call of hoisted.useFilterPresets.mock.calls) {
			expect(call).toEqual(["sessions"]);
		}
	});

	it("setActiveTab switches the active tab", () => {
		const { result } = renderSheet();
		act(() => {
			result.current.setActiveTab("create");
		});
		expect(result.current.activeTab).toBe("create");
		act(() => {
			result.current.setActiveTab("saved");
		});
		expect(result.current.activeTab).toBe("saved");
	});

	describe("onApplyPreset", () => {
		it("calls onApply with the preset's payload, then onOpenChange(false)", () => {
			const callOrder: string[] = [];
			const onApply = vi.fn(() => callOrder.push("onApply"));
			const onOpenChange = vi.fn(() => callOrder.push("onOpenChange"));
			const { result } = renderSheet({ onApply, onOpenChange });
			const preset = makePreset({ payload: { period: "last_30_days" } });

			act(() => {
				result.current.onApplyPreset(preset);
			});

			expect(onApply).toHaveBeenCalledTimes(1);
			expect(onApply).toHaveBeenNthCalledWith(1, { period: "last_30_days" });
			expect(onOpenChange).toHaveBeenCalledTimes(1);
			expect(onOpenChange).toHaveBeenNthCalledWith(1, false);
			expect(callOrder).toEqual(["onApply", "onOpenChange"]);
		});
	});

	describe("onToggleDefault", () => {
		it("calls setDefault when the preset is not currently default", () => {
			const { result } = renderSheet();
			const preset = makePreset({ id: "p2", isDefault: false });

			act(() => {
				result.current.onToggleDefault(preset);
			});

			expect(hoisted.setDefault).toHaveBeenCalledTimes(1);
			expect(hoisted.setDefault).toHaveBeenNthCalledWith(1, "p2");
			expect(hoisted.clearDefault).not.toHaveBeenCalled();
		});

		it("calls clearDefault when the preset is already default", () => {
			const { result } = renderSheet();
			const preset = makePreset({ id: "p3", isDefault: true });

			act(() => {
				result.current.onToggleDefault(preset);
			});

			expect(hoisted.clearDefault).toHaveBeenCalledTimes(1);
			expect(hoisted.clearDefault).toHaveBeenNthCalledWith(1, "p3");
			expect(hoisted.setDefault).not.toHaveBeenCalled();
		});
	});

	describe("delete confirmation", () => {
		it("onRequestDelete sets the pending-delete target", () => {
			const { result } = renderSheet();
			const preset = makePreset({ id: "p4" });

			act(() => {
				result.current.onRequestDelete(preset);
			});

			expect(result.current.pendingDelete).toEqual(preset);
		});

		it("onCancelDelete clears the pending-delete target without calling remove", () => {
			const { result } = renderSheet();
			const preset = makePreset({ id: "p5" });

			act(() => {
				result.current.onRequestDelete(preset);
			});
			act(() => {
				result.current.onCancelDelete();
			});

			expect(result.current.pendingDelete).toBeNull();
			expect(hoisted.remove).not.toHaveBeenCalled();
		});

		it("onConfirmDelete removes the pending target and clears it on success", async () => {
			hoisted.remove.mockResolvedValue(undefined);
			const { result } = renderSheet();
			const preset = makePreset({ id: "p6" });

			act(() => {
				result.current.onRequestDelete(preset);
			});
			act(() => {
				result.current.onConfirmDelete();
			});

			expect(hoisted.remove).toHaveBeenCalledTimes(1);
			expect(hoisted.remove).toHaveBeenNthCalledWith(1, "p6");
			await waitFor(() => expect(result.current.pendingDelete).toBeNull());
		});

		it("onConfirmDelete is a no-op when nothing is pending", () => {
			const { result } = renderSheet();

			act(() => {
				result.current.onConfirmDelete();
			});

			expect(hoisted.remove).not.toHaveBeenCalled();
			expect(result.current.pendingDelete).toBeNull();
		});
	});

	describe("onSaveNew", () => {
		it("calls create with the name and currentPayload, then switches to the 'saved' tab", async () => {
			hoisted.create.mockResolvedValue({ id: "temp-1" });
			const { result } = renderSheet();

			act(() => {
				result.current.setActiveTab("create");
			});
			expect(result.current.activeTab).toBe("create");

			act(() => {
				result.current.onSaveNew("My new preset");
			});

			expect(hoisted.create).toHaveBeenCalledTimes(1);
			expect(hoisted.create).toHaveBeenNthCalledWith(1, {
				name: "My new preset",
				payload: currentPayload,
			});

			await waitFor(() => expect(result.current.activeTab).toBe("saved"));
		});
	});
});
