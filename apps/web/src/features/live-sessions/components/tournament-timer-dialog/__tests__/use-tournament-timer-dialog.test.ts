import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTournamentTimerDialog } from "@/features/live-sessions/components/tournament-timer-dialog/use-tournament-timer-dialog";

const DATETIME_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function pad(n: number) {
	return String(n).padStart(2, "0");
}

function toLocal(d: Date) {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

describe("useTournamentTimerDialog", () => {
	it("seeds timerStartedAt from a provided Date value", () => {
		const when = new Date(2026, 3, 10, 15, 30);
		const { result } = renderHook(() =>
			useTournamentTimerDialog({
				open: false,
				timerStartedAt: when,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.form.state.values.timerStartedAt).toBe(toLocal(when));
	});

	it("falls back to the current time when timerStartedAt is null", () => {
		const { result } = renderHook(() =>
			useTournamentTimerDialog({
				open: false,
				timerStartedAt: null,
				onSubmit: vi.fn(),
			})
		);
		// The value must at least match the 16-char local format (YYYY-MM-DDTHH:mm)
		expect(result.current.form.state.values.timerStartedAt).toMatch(
			DATETIME_LOCAL_RE
		);
	});

	it("rejects submission when the field is blanked out", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTournamentTimerDialog({
				open: false,
				timerStartedAt: new Date(2026, 0, 1, 12, 0),
				onSubmit,
			})
		);
		act(() => {
			result.current.form.setFieldValue("timerStartedAt", "");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("calls onSubmit with a Date when the field is valid", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTournamentTimerDialog({
				open: false,
				timerStartedAt: null,
				onSubmit,
			})
		);
		act(() => {
			result.current.form.setFieldValue("timerStartedAt", "2026-02-03T10:15");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		const arg = onSubmit.mock.calls[0][0];
		expect(arg).toBeInstanceOf(Date);
		expect(Number.isNaN(arg.getTime())).toBe(false);
	});

	it("resyncs the field when `open` transitions with a new timerStartedAt", () => {
		const onSubmit = vi.fn();
		const initial = new Date(2026, 0, 1, 8, 0);
		const next = new Date(2026, 0, 1, 9, 45);
		const { result, rerender } = renderHook(
			(p: { open: boolean; timerStartedAt: Date }) =>
				useTournamentTimerDialog({ ...p, onSubmit }),
			{ initialProps: { open: false, timerStartedAt: initial } }
		);
		rerender({ open: true, timerStartedAt: next });
		expect(result.current.form.state.values.timerStartedAt).toBe(toLocal(next));
	});
});
