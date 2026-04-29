import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	useCashGameStartEditor,
	useTournamentStartEditor,
} from "@/features/live-sessions/components/event-editors/session-start-editor/use-session-start-editor";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";

const DATETIME_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function event(
	payload: Record<string, unknown>,
	occurredAt = "2026-04-10T08:00:00"
): SessionEvent {
	return { id: "e-start", eventType: "session_start", payload, occurredAt };
}

describe("useCashGameStartEditor", () => {
	it("defaults buyInAmount to '0' when payload is empty", () => {
		const { result } = renderHook(() =>
			useCashGameStartEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.form.state.values.buyInAmount).toBe("0");
	});

	it("seeds buyInAmount from payload", () => {
		const { result } = renderHook(() =>
			useCashGameStartEditor({
				event: event({ buyInAmount: 500 }),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.form.state.values.buyInAmount).toBe("500");
	});

	it("submits numeric buyInAmount with occurredAt timestamp", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useCashGameStartEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit,
			})
		);
		act(() => {
			result.current.form.setFieldValue("buyInAmount", "1200");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			{ buyInAmount: 1200 },
			expect.any(Number)
		);
	});

	it("rejects empty buyInAmount", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useCashGameStartEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit,
			})
		);
		act(() => {
			result.current.form.setFieldValue("buyInAmount", "");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});
});

describe("useTournamentStartEditor", () => {
	it("initialises timerStartedAt to '' when payload has no timer", () => {
		const { result } = renderHook(() =>
			useTournamentStartEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.form.state.values.timerStartedAt).toBe("");
	});

	it("derives timerStartedAt datetime-local from numeric payload.timerStartedAt (seconds)", () => {
		const { result } = renderHook(() =>
			useTournamentStartEditor({
				event: event({ timerStartedAt: 1_700_000_000 }),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.form.state.values.timerStartedAt).toMatch(
			DATETIME_LOCAL_RE
		);
	});

	it("submits with timerStartedAt = null when blank", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTournamentStartEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit,
			})
		);
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			{ timerStartedAt: null },
			expect.any(Number)
		);
	});

	it("submits integer-second epoch when timerStartedAt is a valid datetime-local", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTournamentStartEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit,
			})
		);
		act(() => {
			result.current.form.setFieldValue("timerStartedAt", "2026-04-10T08:30");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		const [payload] = onSubmit.mock.calls[0];
		expect(typeof payload.timerStartedAt).toBe("number");
		expect(Number.isInteger(payload.timerStartedAt)).toBe(true);
	});
});
