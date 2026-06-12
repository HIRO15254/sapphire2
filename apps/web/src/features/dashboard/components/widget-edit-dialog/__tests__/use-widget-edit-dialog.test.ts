import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWidgetEditDialog } from "../use-widget-edit-dialog";

function createDeferred() {
	let resolve!: (value: unknown) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe("useWidgetEditDialog", () => {
	it("starts with isSaving false", () => {
		const { result } = renderHook(() =>
			useWidgetEditDialog({ onOpenChange: vi.fn(), onSave: vi.fn() })
		);

		expect(result.current.isSaving).toBe(false);
	});

	it("sets isSaving while onSave is pending, then closes and clears it on resolve", async () => {
		const onOpenChange = vi.fn();
		const deferred = createDeferred();
		const onSave = vi.fn().mockReturnValue(deferred.promise);
		const { result } = renderHook(() =>
			useWidgetEditDialog({ onOpenChange, onSave })
		);

		let savePromise: Promise<void> | undefined;
		act(() => {
			savePromise = result.current.onFormSave({ currencyId: "c1" });
		});

		expect(result.current.isSaving).toBe(true);
		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave).toHaveBeenNthCalledWith(1, { currencyId: "c1" });
		expect(onOpenChange).not.toHaveBeenCalled();

		await act(async () => {
			deferred.resolve(undefined);
			await savePromise;
		});

		expect(result.current.isSaving).toBe(false);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenNthCalledWith(1, false);
	});

	it("clears isSaving and does not close when onSave rejects", async () => {
		const onOpenChange = vi.fn();
		const deferred = createDeferred();
		const onSave = vi.fn().mockReturnValue(deferred.promise);
		const { result } = renderHook(() =>
			useWidgetEditDialog({ onOpenChange, onSave })
		);

		let savePromise: Promise<void> | undefined;
		act(() => {
			savePromise = result.current.onFormSave({ currencyId: "c1" });
		});

		expect(result.current.isSaving).toBe(true);

		await act(async () => {
			deferred.reject(new Error("save failed"));
			await savePromise;
		});

		expect(result.current.isSaving).toBe(false);
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("closes immediately when onSave returns undefined (no promise)", async () => {
		const onOpenChange = vi.fn();
		const onSave = vi.fn().mockReturnValue(undefined);
		const { result } = renderHook(() =>
			useWidgetEditDialog({ onOpenChange, onSave })
		);

		await act(async () => {
			await result.current.onFormSave({});
		});

		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave).toHaveBeenNthCalledWith(1, {});
		expect(result.current.isSaving).toBe(false);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenNthCalledWith(1, false);
	});
});
