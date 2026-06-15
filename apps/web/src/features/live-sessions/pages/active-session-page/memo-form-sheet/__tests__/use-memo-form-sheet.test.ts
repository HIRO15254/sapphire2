import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMemoFormSheet } from "@/features/live-sessions/pages/active-session-page/memo-form-sheet/use-memo-form-sheet";

describe("useMemoFormSheet", () => {
	it("submits the entered text", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useMemoFormSheet({ onSubmit }));
		await act(async () => {
			result.current.form.setFieldValue("text", "vs UTG 3bet pot");
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith("vs UTG 3bet pot");
	});

	it("rejects an empty memo", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useMemoFormSheet({ onSubmit }));
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("resets the field after a successful submit", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useMemoFormSheet({ onSubmit }));
		await act(async () => {
			result.current.form.setFieldValue("text", "note");
			await result.current.form.handleSubmit();
		});
		expect(result.current.form.state.values.text).toBe("");
	});
});
