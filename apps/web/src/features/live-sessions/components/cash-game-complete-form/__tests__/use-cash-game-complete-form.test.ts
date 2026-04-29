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
});
