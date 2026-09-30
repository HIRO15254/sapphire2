import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTournamentQuickInput } from "@/features/live-sessions/pages/live-session-page/tournament-quick-input/use-tournament-quick-input";

interface Props {
	currentStack: number | null;
	isSaving: boolean;
	remainingPlayers: number | null;
	totalEntries: number | null;
}

function setup(initialProps: Props) {
	return renderHook(
		(props: Props) => useTournamentQuickInput({ ...props, onSubmit: vi.fn() }),
		{ initialProps }
	);
}

const SERVER: Props = {
	currentStack: 12_000,
	isSaving: false,
	remainingPlayers: 24,
	totalEntries: 48,
};

describe("useTournamentQuickInput", () => {
	it("follows the server values while no save is in flight", () => {
		const { rerender, result } = setup(SERVER);
		expect(result.current.form.state.values).toEqual({
			remainingPlayers: "24",
			stackAmount: "12000",
			totalEntries: "48",
		});

		rerender({ ...SERVER, currentStack: 9000, remainingPlayers: 18 });

		expect(result.current.form.state.values).toEqual({
			remainingPlayers: "18",
			stackAmount: "9000",
			totalEntries: "48",
		});
	});

	it("keeps every entered value when a poll rewinds the session mid-save", () => {
		const { rerender, result } = setup(SERVER);
		act(() => {
			result.current.form.setFieldValue("stackAmount", "30000");
			result.current.form.setFieldValue("remainingPlayers", "9");
		});

		rerender({ ...SERVER, isSaving: true });

		expect(result.current.form.state.values).toMatchObject({
			remainingPlayers: "9",
			stackAmount: "30000",
		});
	});

	it("resumes following the server once the save settles", () => {
		const { rerender, result } = setup(SERVER);
		act(() => {
			result.current.form.setFieldValue("stackAmount", "30000");
		});
		rerender({ ...SERVER, isSaving: true });

		rerender({ ...SERVER, currentStack: 30_000, isSaving: false });

		expect(result.current.form.state.values.stackAmount).toBe("30000");
	});

	it("leaves an untouched optional field out of the payload so the server keeps its value", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTournamentQuickInput({
				currentStack: 12_000,
				isSaving: false,
				onSubmit,
				remainingPlayers: null,
				totalEntries: null,
			})
		);

		await act(async () => {
			await result.current.form.handleSubmit();
		});

		expect(onSubmit).toHaveBeenCalledWith({
			remainingPlayers: undefined,
			stackAmount: 12_000,
			totalEntries: undefined,
		});
	});
});
