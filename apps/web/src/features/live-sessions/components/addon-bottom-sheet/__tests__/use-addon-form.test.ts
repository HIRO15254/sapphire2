import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAddonForm } from "@/features/live-sessions/components/addon-bottom-sheet/use-addon-form";

describe("useAddonForm", () => {
	it("defaults amount to '0' when no initialAmount is provided", () => {
		const { result } = renderHook(() =>
			useAddonForm({ open: false, onSubmit: vi.fn() })
		);
		expect(result.current.form.state.values.amount).toBe("0");
	});

	it("seeds amount from initialAmount (stringified)", () => {
		const { result } = renderHook(() =>
			useAddonForm({ open: false, onSubmit: vi.fn(), initialAmount: 1500 })
		);
		expect(result.current.form.state.values.amount).toBe("1500");
	});

	it("rejects empty input on submit and does not call onSubmit", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useAddonForm({ open: false, onSubmit })
		);
		act(() => {
			result.current.form.setFieldValue("amount", "");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("rejects negative amount on submit", async () => {
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

	it("submits rounded integer amount on valid input", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useAddonForm({ open: false, onSubmit })
		);
		act(() => {
			result.current.form.setFieldValue("amount", "100");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({ amount: 100 });
	});

	it("resets form values whenever `open` transitions with a new initialAmount", () => {
		const onSubmit = vi.fn();
		const { result, rerender } = renderHook(
			(p: { open: boolean; initialAmount?: number }) =>
				useAddonForm({ ...p, onSubmit }),
			{ initialProps: { open: false, initialAmount: 10 } }
		);
		expect(result.current.form.state.values.amount).toBe("10");
		rerender({ open: true, initialAmount: 250 });
		expect(result.current.form.state.values.amount).toBe("250");
	});

	it("reset also fires with '0' when initialAmount is undefined on open", () => {
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
		expect(result.current.form.state.values.amount).toBe("0");
	});
});
