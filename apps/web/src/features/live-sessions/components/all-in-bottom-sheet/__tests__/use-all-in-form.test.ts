import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAllInForm } from "@/features/live-sessions/components/all-in-bottom-sheet/use-all-in-form";

describe("useAllInForm", () => {
	it("applies built-in defaults when initialValues is undefined", () => {
		const { result } = renderHook(() =>
			useAllInForm({ open: false, onSubmit: vi.fn() })
		);
		expect(result.current.form.state.values).toEqual({
			potSize: "0",
			trials: "1",
			equity: "0",
			wins: "0",
		});
	});

	it("seeds all fields from initialValues", () => {
		const { result } = renderHook(() =>
			useAllInForm({
				open: false,
				onSubmit: vi.fn(),
				initialValues: { potSize: 1000, trials: 3, equity: 55, wins: 2 },
			})
		);
		expect(result.current.form.state.values).toEqual({
			potSize: "1000",
			trials: "3",
			equity: "55",
			wins: "2",
		});
	});

	it("rejects equity > 100 on submit", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useAllInForm({ open: false, onSubmit })
		);
		act(() => {
			result.current.form.setFieldValue("equity", "150");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("rejects trials = 0 on submit (min 1 integer)", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useAllInForm({ open: false, onSubmit })
		);
		act(() => {
			result.current.form.setFieldValue("trials", "0");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits parsed numeric payload on valid values", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useAllInForm({ open: false, onSubmit })
		);
		act(() => {
			result.current.form.setFieldValue("potSize", "500");
			result.current.form.setFieldValue("trials", "2");
			result.current.form.setFieldValue("equity", "40");
			result.current.form.setFieldValue("wins", "1");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({
			potSize: 500,
			trials: 2,
			equity: 40,
			wins: 1,
		});
	});

	it("resets to defaults whenever open transitions with no initialValues", () => {
		const onSubmit = vi.fn();
		const { result, rerender } = renderHook(
			(p: {
				open: boolean;
				initialValues?: {
					potSize: number;
					trials: number;
					equity: number;
					wins: number;
				};
			}) => useAllInForm({ ...p, onSubmit }),
			{ initialProps: { open: false } }
		);
		act(() => {
			result.current.form.setFieldValue("potSize", "999");
		});
		rerender({ open: true });
		expect(result.current.form.state.values.potSize).toBe("0");
	});

	it("resets to initialValues when open changes and initialValues provided", () => {
		const onSubmit = vi.fn();
		interface Props {
			initialValues?: {
				potSize: number;
				trials: number;
				equity: number;
				wins: number;
			};
			open: boolean;
		}
		const { result, rerender } = renderHook(
			(p: Props) => useAllInForm({ ...p, onSubmit }),
			{ initialProps: { open: false } as Props }
		);
		rerender({
			open: true,
			initialValues: { potSize: 300, trials: 2, equity: 60, wins: 1 },
		});
		expect(result.current.form.state.values).toEqual({
			potSize: "300",
			trials: "2",
			equity: "60",
			wins: "1",
		});
	});
});
