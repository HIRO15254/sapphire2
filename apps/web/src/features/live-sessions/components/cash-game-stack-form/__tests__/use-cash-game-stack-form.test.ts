import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useCashGameStackForm } from "@/features/live-sessions/components/cash-game-stack-form/use-cash-game-stack-form";
import { SessionFormProvider } from "@/features/live-sessions/hooks/use-session-form";

function wrapper({ children }: { children: ReactNode }) {
	return createElement(SessionFormProvider, null, children);
}

describe("useCashGameStackForm", () => {
	it("initialises stackForm and memoForm to empty values and all sheet flags to false", () => {
		const { result } = renderHook(
			() => useCashGameStackForm({ onMemo: vi.fn(), onSubmit: vi.fn() }),
			{ wrapper }
		);
		expect(result.current.stackForm.state.values.stackAmount).toBe("");
		expect(result.current.memoForm.state.values.text).toBe("");
		expect(result.current.allInBottomSheetOpen).toBe(false);
		expect(result.current.addonBottomSheetOpen).toBe(false);
		expect(result.current.removeBottomSheetOpen).toBe(false);
		expect(result.current.memoBottomSheetOpen).toBe(false);
	});

	it("rejects stackForm submission when stackAmount is empty", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(
			() => useCashGameStackForm({ onMemo: vi.fn(), onSubmit }),
			{ wrapper }
		);
		await act(async () => {
			await result.current.stackForm.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits numeric stackAmount via stackForm", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(
			() => useCashGameStackForm({ onMemo: vi.fn(), onSubmit }),
			{ wrapper }
		);
		act(() => {
			result.current.stackForm.setFieldValue("stackAmount", "4000");
		});
		await act(async () => {
			await result.current.stackForm.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({ stackAmount: 4000 });
	});

	it("rejects memoForm submission when text is blank", async () => {
		const onMemo = vi.fn();
		const { result } = renderHook(
			() => useCashGameStackForm({ onMemo, onSubmit: vi.fn() }),
			{ wrapper }
		);
		await act(async () => {
			await result.current.memoForm.handleSubmit();
		});
		expect(onMemo).not.toHaveBeenCalled();
	});

	it("submits memo text, resets the form, and closes the memo sheet", async () => {
		const onMemo = vi.fn();
		const { result } = renderHook(
			() => useCashGameStackForm({ onMemo, onSubmit: vi.fn() }),
			{ wrapper }
		);
		act(() => {
			result.current.setMemoBottomSheetOpen(true);
			result.current.memoForm.setFieldValue("text", "memo note");
		});
		await act(async () => {
			await result.current.memoForm.handleSubmit();
		});
		expect(onMemo).toHaveBeenCalledWith("memo note");
		expect(result.current.memoBottomSheetOpen).toBe(false);
		expect(result.current.memoForm.state.values.text).toBe("");
	});

	it("syncs stackForm.stackAmount from context when setStackAmount changes it", () => {
		const { result } = renderHook(
			() => useCashGameStackForm({ onMemo: vi.fn(), onSubmit: vi.fn() }),
			{ wrapper }
		);
		act(() => {
			result.current.setStackAmount("1234");
		});
		expect(result.current.stackAmount).toBe("1234");
		expect(result.current.stackForm.state.values.stackAmount).toBe("1234");
	});

	it("toggles each bottom-sheet flag independently", () => {
		const { result } = renderHook(
			() => useCashGameStackForm({ onMemo: vi.fn(), onSubmit: vi.fn() }),
			{ wrapper }
		);
		act(() => {
			result.current.setAllInBottomSheetOpen(true);
		});
		expect(result.current.allInBottomSheetOpen).toBe(true);
		act(() => {
			result.current.setAddonBottomSheetOpen(true);
		});
		expect(result.current.addonBottomSheetOpen).toBe(true);
		act(() => {
			result.current.setRemoveBottomSheetOpen(true);
		});
		expect(result.current.removeBottomSheetOpen).toBe(true);
	});
});
