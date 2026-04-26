import { act, renderHook } from "@testing-library/react";
import type { MouseEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { useEntityListItem } from "@/shared/components/management/entity-list-item/use-entity-list-item";

function mouseEventStub() {
	return { stopPropagation: vi.fn() } as unknown as MouseEvent;
}

describe("useEntityListItem", () => {
	describe("initial state", () => {
		it("starts with confirmingDelete=false and internalExpandedValue=null", () => {
			const { result } = renderHook(() =>
				useEntityListItem({ isControlled: false })
			);
			expect(result.current.confirmingDelete).toBe(false);
			expect(result.current.internalExpandedValue).toBeNull();
		});
	});

	describe("handleStartDelete", () => {
		it("stops event propagation and sets confirmingDelete=true", () => {
			const { result } = renderHook(() =>
				useEntityListItem({ isControlled: false })
			);
			const event = mouseEventStub();
			act(() => result.current.handleStartDelete(event));
			expect(event.stopPropagation).toHaveBeenCalledTimes(1);
			expect(result.current.confirmingDelete).toBe(true);
		});
	});

	describe("handleCancelDelete", () => {
		it("stops event propagation and resets confirmingDelete", () => {
			const { result } = renderHook(() =>
				useEntityListItem({ isControlled: false })
			);
			act(() => result.current.handleStartDelete(mouseEventStub()));
			const event = mouseEventStub();
			act(() => result.current.handleCancelDelete(event));
			expect(event.stopPropagation).toHaveBeenCalledTimes(1);
			expect(result.current.confirmingDelete).toBe(false);
		});
	});

	describe("handleConfirmDelete", () => {
		it("invokes onDelete, stops propagation, resets confirmingDelete, and clears expansion when uncontrolled", () => {
			const onExpandedValueChange = vi.fn();
			const { result } = renderHook(() =>
				useEntityListItem({ isControlled: false, onExpandedValueChange })
			);
			act(() => result.current.handleExpandedValueChange("item-1"));
			act(() => result.current.handleStartDelete(mouseEventStub()));

			const onDelete = vi.fn();
			const event = mouseEventStub();
			act(() => result.current.handleConfirmDelete(event, onDelete));

			expect(event.stopPropagation).toHaveBeenCalledTimes(1);
			expect(onDelete).toHaveBeenCalledTimes(1);
			expect(result.current.confirmingDelete).toBe(false);
			expect(result.current.internalExpandedValue).toBeNull();
			expect(onExpandedValueChange).toHaveBeenCalledWith(null);
		});

		it("does NOT overwrite internalExpandedValue when controlled", () => {
			const onExpandedValueChange = vi.fn();
			const { result } = renderHook(() =>
				useEntityListItem({ isControlled: true, onExpandedValueChange })
			);
			// In controlled mode, handleExpandedValueChange should not update internal.
			act(() => result.current.handleExpandedValueChange("item-1"));
			expect(result.current.internalExpandedValue).toBeNull();

			const onDelete = vi.fn();
			act(() => result.current.handleConfirmDelete(mouseEventStub(), onDelete));
			expect(onDelete).toHaveBeenCalled();
			expect(result.current.internalExpandedValue).toBeNull();
			expect(onExpandedValueChange).toHaveBeenLastCalledWith(null);
		});
	});

	describe("handleExpandedValueChange", () => {
		it("updates internal state when uncontrolled", () => {
			const { result } = renderHook(() =>
				useEntityListItem({ isControlled: false })
			);
			act(() => result.current.handleExpandedValueChange("item-1"));
			expect(result.current.internalExpandedValue).toBe("item-1");
		});

		it("leaves internal state untouched when controlled", () => {
			const { result } = renderHook(() =>
				useEntityListItem({ isControlled: true })
			);
			act(() => result.current.handleExpandedValueChange("item-1"));
			expect(result.current.internalExpandedValue).toBeNull();
		});

		it("resets confirmingDelete on expansion change", () => {
			const { result } = renderHook(() =>
				useEntityListItem({ isControlled: false })
			);
			act(() => result.current.handleStartDelete(mouseEventStub()));
			expect(result.current.confirmingDelete).toBe(true);
			act(() => result.current.handleExpandedValueChange("item-2"));
			expect(result.current.confirmingDelete).toBe(false);
		});

		it("forwards the new value to onExpandedValueChange", () => {
			const onExpandedValueChange = vi.fn();
			const { result } = renderHook(() =>
				useEntityListItem({ isControlled: false, onExpandedValueChange })
			);
			act(() => result.current.handleExpandedValueChange("item-3"));
			expect(onExpandedValueChange).toHaveBeenCalledWith("item-3");
		});

		it("forwards null when expansion is cleared", () => {
			const onExpandedValueChange = vi.fn();
			const { result } = renderHook(() =>
				useEntityListItem({ isControlled: false, onExpandedValueChange })
			);
			act(() => result.current.handleExpandedValueChange(null));
			expect(onExpandedValueChange).toHaveBeenCalledWith(null);
		});

		it("does not throw if onExpandedValueChange is not provided", () => {
			const { result } = renderHook(() =>
				useEntityListItem({ isControlled: false })
			);
			expect(() =>
				act(() => result.current.handleExpandedValueChange("item-x"))
			).not.toThrow();
		});
	});
});
