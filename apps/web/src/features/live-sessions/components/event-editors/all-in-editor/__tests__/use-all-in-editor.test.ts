import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAllInEditor } from "@/features/live-sessions/components/event-editors/all-in-editor/use-all-in-editor";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";

const MUST_BE_AFTER = /Must be after/;

function baseEvent(
	payload: Record<string, unknown>,
	occurredAt = "2026-04-10T12:30:00"
): SessionEvent {
	return {
		id: "e1",
		eventType: "all_in",
		payload,
		occurredAt,
	};
}

describe("useAllInEditor", () => {
	it("falls back to safe defaults when payload is empty", () => {
		const { result } = renderHook(() =>
			useAllInEditor({
				event: baseEvent({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.form.state.values).toEqual({
			time: "12:30",
			potSize: "0",
			trials: "1",
			equity: "0",
			wins: "0",
		});
	});

	it("seeds numeric fields from payload values", () => {
		const { result } = renderHook(() =>
			useAllInEditor({
				event: baseEvent({
					potSize: 1500,
					trials: 3,
					equity: 55,
					wins: 1,
				}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.form.state.values).toMatchObject({
			potSize: "1500",
			trials: "3",
			equity: "55",
			wins: "1",
		});
	});

	it("rejects submission when equity > 100", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useAllInEditor({
				event: baseEvent({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit,
			})
		);
		act(() => {
			result.current.form.setFieldValue("equity", "200");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits numeric payload and a computed occurredAt timestamp", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useAllInEditor({
				event: baseEvent({}, "2026-04-10T12:30:00"),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit,
			})
		);
		act(() => {
			result.current.form.setFieldValue("time", "13:45");
			result.current.form.setFieldValue("potSize", "1000");
			result.current.form.setFieldValue("trials", "2");
			result.current.form.setFieldValue("equity", "40");
			result.current.form.setFieldValue("wins", "1");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		const [payload, ts] = onSubmit.mock.calls[0];
		expect(payload).toEqual({ potSize: 1000, trials: 2, equity: 40, wins: 1 });
		expect(typeof ts).toBe("number");
	});

	it("timeValidator surfaces an error when time is before minTime", () => {
		const event = baseEvent({}, "2026-04-10T12:30:00");
		const minTime = new Date("2026-04-10T12:30:00");
		const { result } = renderHook(() =>
			useAllInEditor({
				event,
				isLoading: false,
				maxTime: null,
				minTime,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.timeValidator("11:00")).toMatch(MUST_BE_AFTER);
	});

	it("timeValidator returns undefined when within range", () => {
		const { result } = renderHook(() =>
			useAllInEditor({
				event: baseEvent({}, "2026-04-10T12:30:00"),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.timeValidator("13:00")).toBeUndefined();
	});
});
