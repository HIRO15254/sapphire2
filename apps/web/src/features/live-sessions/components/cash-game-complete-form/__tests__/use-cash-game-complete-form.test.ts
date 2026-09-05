import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCashGameCompleteForm } from "@/features/live-sessions/components/cash-game-complete-form/use-cash-game-complete-form";

describe("useCashGameCompleteForm", () => {
	it("seeds finalStack with empty string when defaultFinalStack is undefined", () => {
		const { result } = renderHook(() =>
			useCashGameCompleteForm({ onSubmit: vi.fn() })
		);
		expect(result.current.form.state.values.finalStack).toBe("");
	});

	it("seeds finalStack from the defaultFinalStack prop", () => {
		const { result } = renderHook(() =>
			useCashGameCompleteForm({ onSubmit: vi.fn(), defaultFinalStack: 42 })
		);
		expect(result.current.form.state.values.finalStack).toBe("42");
	});

	it("rejects empty finalStack on submit", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useCashGameCompleteForm({ onSubmit }));
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("rejects negative finalStack on submit", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useCashGameCompleteForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("finalStack", "-1");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits finalStack as a parsed integer on valid input", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useCashGameCompleteForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("finalStack", "1250");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({ finalStack: 1250 });
	});

	it("returns a null preview when previewInput is not provided", () => {
		const { result } = renderHook(() =>
			useCashGameCompleteForm({ onSubmit: vi.fn(), defaultFinalStack: 51_800 })
		);
		expect(result.current.preview).toBeNull();
	});

	it("returns a null preview when finalStack is blank", () => {
		const { result } = renderHook(() =>
			useCashGameCompleteForm({
				onSubmit: vi.fn(),
				previewInput: {
					chipRemoveTotal: 10_000,
					evDiff: -2728,
					totalBuyIn: 50_000,
				},
			})
		);
		expect(result.current.preview).toBeNull();
	});

	it("computes a preview from the default finalStack and previewInput", () => {
		const { result } = renderHook(() =>
			useCashGameCompleteForm({
				onSubmit: vi.fn(),
				defaultFinalStack: 51_800,
				previewInput: {
					chipRemoveTotal: 10_000,
					evDiff: -2728,
					totalBuyIn: 50_000,
				},
			})
		);
		expect(result.current.preview).toEqual({
			evResult: 9072,
			result: 11_800,
			totalBuyIn: 50_000,
			totalWithdrawn: 10_000,
		});
	});

	it("recomputes the preview reactively as finalStack changes", () => {
		const { result } = renderHook(() =>
			useCashGameCompleteForm({
				onSubmit: vi.fn(),
				defaultFinalStack: 51_800,
				previewInput: {
					chipRemoveTotal: 10_000,
					evDiff: -2728,
					totalBuyIn: 50_000,
				},
			})
		);
		act(() => {
			result.current.form.setFieldValue("finalStack", "5000");
		});
		expect(result.current.preview).toEqual({
			evResult: -37_728,
			result: -35_000,
			totalBuyIn: 50_000,
			totalWithdrawn: 10_000,
		});
	});

	it("leaves evResult null in the preview when evDiff is null", () => {
		const { result } = renderHook(() =>
			useCashGameCompleteForm({
				onSubmit: vi.fn(),
				defaultFinalStack: 20_000,
				previewInput: { chipRemoveTotal: 0, evDiff: null, totalBuyIn: 20_000 },
			})
		);
		expect(result.current.preview).toEqual({
			evResult: null,
			result: 0,
			totalBuyIn: 20_000,
			totalWithdrawn: 0,
		});
	});

	it("still submits the unchanged payload contract when previewInput is provided", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useCashGameCompleteForm({
				onSubmit,
				previewInput: { chipRemoveTotal: 0, evDiff: null, totalBuyIn: 0 },
			})
		);
		act(() => {
			result.current.form.setFieldValue("finalStack", "1250");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenNthCalledWith(1, { finalStack: 1250 });
	});
});
