import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
	useFilterPresets: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
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
		isUpdatePending: false,
		isDeletePending: false,
		isSetDefaultPending: false,
		isClearDefaultPending: false,
		create: hoisted.create,
		update: hoisted.update,
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
			hoisted.update,
			hoisted.remove,
			hoisted.setDefault,
			hoisted.clearDefault,
		]) {
			m.mockReset();
			m.mockResolvedValue(undefined);
		}
		hoisted.useFilterPresets.mockReturnValue(presetsStub());
	});

	function renderSheet(
		overrides: Partial<{
			onApply: (payload: unknown) => void;
			onOpenChange: (open: boolean) => void;
			open: boolean;
		}> = {}
	) {
		const onApply = overrides.onApply ?? vi.fn();
		const onOpenChange = overrides.onOpenChange ?? vi.fn();
		const view = renderHook(
			({ open }: { open: boolean }) =>
				useFilterPresetsSheet({
					screenKey: "sessions",
					currentPayload,
					onApply,
					onOpenChange,
					open,
				}),
			{ initialProps: { open: overrides.open ?? true } }
		);
		return { ...view, onApply, onOpenChange };
	}

	it("starts on the 'saved' tab with no pending delete or edit", () => {
		const { result } = renderSheet();
		expect(result.current.activeTab).toBe("saved");
		expect(result.current.pendingDelete).toBeNull();
		expect(result.current.pendingEdit).toBeNull();
	});

	it("forwards presets/isLoading and pending flags from useFilterPresets", () => {
		const preset = makePreset({ isDefault: true });
		hoisted.useFilterPresets.mockReturnValue(
			presetsStub({
				presets: [preset],
				defaultPreset: preset,
				isLoading: true,
				isCreatePending: true,
				isUpdatePending: true,
				isDeletePending: true,
				isSetDefaultPending: true,
			})
		);
		const { result } = renderSheet();
		expect(result.current.presets).toEqual([preset]);
		expect(result.current.isLoading).toBe(true);
		expect(result.current.isCreatePending).toBe(true);
		expect(result.current.isUpdatePending).toBe(true);
		expect(result.current.isDeletePending).toBe(true);
		expect(result.current.isDefaultTogglePending).toBe(true);
	});

	it.each([
		["setDefault", { isSetDefaultPending: true }],
		["clearDefault", { isClearDefaultPending: true }],
	])("reports isDefaultTogglePending while %s is in flight", (_label, pendingFlags) => {
		hoisted.useFilterPresets.mockReturnValue(
			presetsStub({ presets: [makePreset()], ...pendingFlags })
		);
		const { result } = renderSheet();
		expect(result.current.isDefaultTogglePending).toBe(true);
	});

	it("reports isDefaultTogglePending false when neither direction is in flight", () => {
		hoisted.useFilterPresets.mockReturnValue(
			presetsStub({ presets: [makePreset()] })
		);
		const { result } = renderSheet();
		expect(result.current.isDefaultTogglePending).toBe(false);
	});

	it("does not expose defaultPreset", () => {
		hoisted.useFilterPresets.mockReturnValue(
			presetsStub({ defaultPreset: makePreset({ isDefault: true }) })
		);
		const { result } = renderSheet();
		expect(result.current).not.toHaveProperty("defaultPreset");
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

		it("resolves without rejecting when setDefault fails", async () => {
			hoisted.setDefault.mockRejectedValue(new Error("Network error"));
			const { result } = renderSheet();
			const preset = makePreset({ id: "p15", isDefault: false });

			await act(async () => {
				await expect(
					result.current.onToggleDefault(preset)
				).resolves.toBeUndefined();
			});

			expect(hoisted.setDefault).toHaveBeenCalledTimes(1);
		});

		it("resolves without rejecting when clearDefault fails", async () => {
			hoisted.clearDefault.mockRejectedValue(new Error("Network error"));
			const { result } = renderSheet();
			const preset = makePreset({ id: "p16", isDefault: true });

			await act(async () => {
				await expect(
					result.current.onToggleDefault(preset)
				).resolves.toBeUndefined();
			});

			expect(hoisted.clearDefault).toHaveBeenCalledTimes(1);
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

	describe("rename / overwrite", () => {
		it("onRequestEdit sets the pending-edit target", () => {
			const { result } = renderSheet();
			const preset = makePreset({ id: "p7" });

			act(() => {
				result.current.onRequestEdit(preset);
			});

			expect(result.current.pendingEdit).toEqual(preset);
			expect(hoisted.update).not.toHaveBeenCalled();
		});

		it("onCancelEdit clears the pending-edit target without calling update", () => {
			const { result } = renderSheet();
			const preset = makePreset({ id: "p8" });

			act(() => {
				result.current.onRequestEdit(preset);
			});
			act(() => {
				result.current.onCancelEdit();
			});

			expect(result.current.pendingEdit).toBeNull();
			expect(hoisted.update).not.toHaveBeenCalled();
		});

		it("onSubmitEdit renames the pending preset and overwrites it with currentPayload, then clears it", async () => {
			hoisted.update.mockResolvedValue({ id: "p9" });
			const { result } = renderSheet();
			const preset = makePreset({ id: "p9", name: "Old name" });

			act(() => {
				result.current.onRequestEdit(preset);
			});
			act(() => {
				result.current.onSubmitEdit("New name");
			});

			expect(hoisted.update).toHaveBeenCalledTimes(1);
			expect(hoisted.update).toHaveBeenNthCalledWith(1, {
				id: "p9",
				name: "New name",
				payload: currentPayload,
			});
			await waitFor(() => expect(result.current.pendingEdit).toBeNull());
		});

		it("onSubmitEdit is a no-op when nothing is pending", () => {
			const { result } = renderSheet();

			act(() => {
				result.current.onSubmitEdit("Whatever");
			});

			expect(hoisted.update).not.toHaveBeenCalled();
			expect(result.current.pendingEdit).toBeNull();
		});

		it("keeps the edit form open and resolves when update rejects", async () => {
			hoisted.update.mockRejectedValue(
				new Error("You already have a filter preset with this name")
			);
			const { result } = renderSheet();
			const preset = makePreset({ id: "p10", name: "Old name" });

			act(() => {
				result.current.onRequestEdit(preset);
			});
			await act(async () => {
				await expect(
					result.current.onSubmitEdit("Taken name")
				).resolves.toBeUndefined();
			});

			expect(result.current.pendingEdit).toEqual(preset);
		});
	});

	describe("rejected mutations are handled", () => {
		it("onSaveNew resolves and stays on the 'create' tab when create rejects", async () => {
			hoisted.create.mockRejectedValue(
				new Error("You already have a filter preset with this name")
			);
			const { result } = renderSheet();

			act(() => {
				result.current.setActiveTab("create");
			});
			await act(async () => {
				await expect(
					result.current.onSaveNew("Duplicate")
				).resolves.toBeUndefined();
			});

			expect(result.current.activeTab).toBe("create");
		});

		it("onConfirmDelete resolves and keeps the pending target when remove rejects", async () => {
			hoisted.remove.mockRejectedValue(new Error("Network error"));
			const { result } = renderSheet();
			const preset = makePreset({ id: "p11" });

			act(() => {
				result.current.onRequestDelete(preset);
			});
			await act(async () => {
				await expect(result.current.onConfirmDelete()).resolves.toBeUndefined();
			});

			expect(result.current.pendingDelete).toEqual(preset);
		});
	});

	describe("state reset when the sheet closes", () => {
		it("resets the active tab to 'saved'", () => {
			const { result, rerender } = renderSheet({ open: true });

			act(() => {
				result.current.setActiveTab("create");
			});
			expect(result.current.activeTab).toBe("create");

			rerender({ open: false });

			expect(result.current.activeTab).toBe("saved");
		});

		it("clears a pending delete", () => {
			const { result, rerender } = renderSheet({ open: true });

			act(() => {
				result.current.onRequestDelete(makePreset({ id: "p12" }));
			});
			rerender({ open: false });

			expect(result.current.pendingDelete).toBeNull();
			expect(hoisted.remove).not.toHaveBeenCalled();
		});

		it("clears a pending edit", () => {
			const { result, rerender } = renderSheet({ open: true });

			act(() => {
				result.current.onRequestEdit(makePreset({ id: "p13" }));
			});
			rerender({ open: false });

			expect(result.current.pendingEdit).toBeNull();
			expect(hoisted.update).not.toHaveBeenCalled();
		});

		it("keeps the active tab across re-renders while the sheet stays open", () => {
			const { result, rerender } = renderSheet({ open: true });

			act(() => {
				result.current.setActiveTab("create");
			});
			rerender({ open: true });

			expect(result.current.activeTab).toBe("create");
		});

		it("keeps a pending delete across re-renders while the sheet stays open", () => {
			const { result, rerender } = renderSheet({ open: true });
			const preset = makePreset({ id: "p14" });

			act(() => {
				result.current.onRequestDelete(preset);
			});
			rerender({ open: true });

			expect(result.current.pendingDelete).toEqual(preset);
		});

		it("keeps a pending edit across re-renders while the sheet stays open", () => {
			const { result, rerender } = renderSheet({ open: true });
			const preset = makePreset({ id: "p14" });

			act(() => {
				result.current.onRequestEdit(preset);
			});
			rerender({ open: true });

			expect(result.current.pendingEdit).toEqual(preset);
		});

		it("reopening after a close keeps the reset state", () => {
			const { result, rerender } = renderSheet({ open: true });

			act(() => {
				result.current.setActiveTab("create");
			});
			rerender({ open: false });
			rerender({ open: true });

			expect(result.current.activeTab).toBe("saved");
			expect(result.current.pendingDelete).toBeNull();
			expect(result.current.pendingEdit).toBeNull();
		});
	});
	describe("edit state consistency", () => {
		it("clears a pending edit when the user switches tabs", () => {
			const preset = makePreset();
			hoisted.useFilterPresets.mockReturnValue(
				presetsStub({ presets: [preset] })
			);
			const { result } = renderSheet();

			act(() => {
				result.current.onRequestEdit(preset);
			});
			expect(result.current.pendingEdit).toEqual(preset);

			act(() => {
				result.current.setActiveTab("create");
			});
			expect(result.current.pendingEdit).toBeNull();
		});

		it("does not resurrect the edit form when switching back to the saved tab", () => {
			const preset = makePreset();
			hoisted.useFilterPresets.mockReturnValue(
				presetsStub({ presets: [preset] })
			);
			const { result } = renderSheet();

			act(() => {
				result.current.onRequestEdit(preset);
			});
			act(() => {
				result.current.setActiveTab("create");
			});
			act(() => {
				result.current.setActiveTab("saved");
			});
			expect(result.current.pendingEdit).toBeNull();
		});

		it("clears a pending edit when a delete is requested", () => {
			const preset = makePreset();
			hoisted.useFilterPresets.mockReturnValue(
				presetsStub({ presets: [preset] })
			);
			const { result } = renderSheet();

			act(() => {
				result.current.onRequestEdit(preset);
			});
			act(() => {
				result.current.onRequestDelete(preset);
			});

			expect(result.current.pendingEdit).toBeNull();
			expect(result.current.pendingDelete).toEqual(preset);
		});

		it("clears a pending delete when an edit is requested", () => {
			const preset = makePreset();
			hoisted.useFilterPresets.mockReturnValue(
				presetsStub({ presets: [preset] })
			);
			const { result } = renderSheet();

			act(() => {
				result.current.onRequestDelete(preset);
			});
			act(() => {
				result.current.onRequestEdit(preset);
			});

			expect(result.current.pendingDelete).toBeNull();
			expect(result.current.pendingEdit).toEqual(preset);
		});
	});
});
