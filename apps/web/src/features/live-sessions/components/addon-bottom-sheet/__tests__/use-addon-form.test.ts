import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAddonForm } from "@/features/live-sessions/components/addon-bottom-sheet/use-addon-form";

describe("useAddonForm", () => {
	describe("defaults with no initialAmount", () => {
		it("defaults amount to '' and direction to 'add'", () => {
			const { result } = renderHook(() =>
				useAddonForm({ open: false, onSubmit: vi.fn() })
			);
			expect(result.current.form.state.values.amount).toBe("");
			expect(result.current.form.state.values.direction).toBe("add");
		});
	});

	describe("defaults with an initialAmount", () => {
		it("seeds direction 'add' and the absolute amount for a positive initialAmount", () => {
			const { result } = renderHook(() =>
				useAddonForm({ open: false, onSubmit: vi.fn(), initialAmount: 1500 })
			);
			expect(result.current.form.state.values.amount).toBe("1500");
			expect(result.current.form.state.values.direction).toBe("add");
		});

		it("seeds direction 'remove' and the absolute amount for a negative initialAmount", () => {
			const { result } = renderHook(() =>
				useAddonForm({ open: false, onSubmit: vi.fn(), initialAmount: -1500 })
			);
			expect(result.current.form.state.values.amount).toBe("1500");
			expect(result.current.form.state.values.direction).toBe("remove");
		});
	});

	describe("submit validation", () => {
		it("rejects empty amount and does not call onSubmit", async () => {
			const onSubmit = vi.fn();
			const { result } = renderHook(() =>
				useAddonForm({ open: false, onSubmit })
			);
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).not.toHaveBeenCalled();
		});

		it("rejects amount '0' and does not call onSubmit", async () => {
			const onSubmit = vi.fn();
			const { result } = renderHook(() =>
				useAddonForm({ open: false, onSubmit })
			);
			act(() => {
				result.current.form.setFieldValue("amount", "0");
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).not.toHaveBeenCalled();
		});

		it("rejects a negative amount and does not call onSubmit", async () => {
			const onSubmit = vi.fn();
			const { result } = renderHook(() =>
				useAddonForm({ open: false, onSubmit })
			);
			act(() => {
				result.current.form.setFieldValue("amount", "-5");
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).not.toHaveBeenCalled();
		});

		it("rejects a non-numeric amount and does not call onSubmit", async () => {
			const onSubmit = vi.fn();
			const { result } = renderHook(() =>
				useAddonForm({ open: false, onSubmit })
			);
			act(() => {
				result.current.form.setFieldValue("amount", "abc");
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).not.toHaveBeenCalled();
		});
	});

	describe("submit sign", () => {
		it("emits a positive amount when direction is 'add'", async () => {
			const onSubmit = vi.fn();
			const { result } = renderHook(() =>
				useAddonForm({ open: false, onSubmit })
			);
			act(() => {
				result.current.form.setFieldValue("amount", "500");
				result.current.form.setFieldValue("direction", "add");
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).toHaveBeenCalledTimes(1);
			expect(onSubmit).toHaveBeenCalledWith({ amount: 500 });
		});

		it("emits a negative amount when direction is 'remove'", async () => {
			const onSubmit = vi.fn();
			const { result } = renderHook(() =>
				useAddonForm({ open: false, onSubmit })
			);
			act(() => {
				result.current.form.setFieldValue("amount", "500");
				result.current.form.setFieldValue("direction", "remove");
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).toHaveBeenCalledTimes(1);
			expect(onSubmit).toHaveBeenCalledWith({ amount: -500 });
		});
	});

	describe("reset on re-open", () => {
		it("resets amount and direction to the new initialAmount's defaults", () => {
			const onSubmit = vi.fn();
			const { result, rerender } = renderHook(
				(p: { open: boolean; initialAmount?: number }) =>
					useAddonForm({ ...p, onSubmit }),
				{ initialProps: { open: false, initialAmount: 10 } }
			);
			expect(result.current.form.state.values.amount).toBe("10");
			expect(result.current.form.state.values.direction).toBe("add");
			rerender({ open: true, initialAmount: -250 });
			expect(result.current.form.state.values.amount).toBe("250");
			expect(result.current.form.state.values.direction).toBe("remove");
		});

		it("resets to an empty amount and direction 'add' when initialAmount is undefined on open", () => {
			const onSubmit = vi.fn();
			interface Props {
				initialAmount?: number;
				open: boolean;
			}
			const { result, rerender } = renderHook(
				(p: Props) => useAddonForm({ ...p, onSubmit }),
				{ initialProps: { open: false, initialAmount: 42 } as Props }
			);
			rerender({ open: true });
			expect(result.current.form.state.values.amount).toBe("");
			expect(result.current.form.state.values.direction).toBe("add");
		});
	});
});
