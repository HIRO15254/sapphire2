import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStackQuickInput } from "@/features/live-sessions/pages/live-session-page/stack-quick-input/use-stack-quick-input";

interface Props {
	currentStack: number | null;
	isSaving: boolean;
}

function setup(initialProps: Props) {
	return renderHook(
		({ currentStack, isSaving }: Props) =>
			useStackQuickInput({ currentStack, isSaving, onSubmit: vi.fn() }),
		{ initialProps }
	);
}

describe("useStackQuickInput", () => {
	it("follows the server value while no save is in flight", () => {
		const { rerender, result } = setup({
			currentStack: 12_000,
			isSaving: false,
		});
		expect(result.current.form.state.values.stackAmount).toBe("12000");

		rerender({ currentStack: 24_500, isSaving: false });

		expect(result.current.form.state.values.stackAmount).toBe("24500");
	});

	it("keeps the entered value when a poll rewinds the stack mid-save", () => {
		const { rerender, result } = setup({
			currentStack: 12_000,
			isSaving: false,
		});
		act(() => {
			result.current.form.setFieldValue("stackAmount", "18000");
		});

		rerender({ currentStack: 18_000, isSaving: true });
		rerender({ currentStack: 12_000, isSaving: true });

		expect(result.current.form.state.values.stackAmount).toBe("18000");
	});

	it("resumes following the server once the save settles", () => {
		const { rerender, result } = setup({
			currentStack: 12_000,
			isSaving: false,
		});
		act(() => {
			result.current.form.setFieldValue("stackAmount", "18000");
		});
		rerender({ currentStack: 12_000, isSaving: true });

		rerender({ currentStack: 12_000, isSaving: false });

		expect(result.current.form.state.values.stackAmount).toBe("12000");
	});
});
