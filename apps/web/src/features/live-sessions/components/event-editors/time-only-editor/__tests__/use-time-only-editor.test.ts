import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTimeOnlyEditor } from "@/features/live-sessions/components/event-editors/time-only-editor/use-time-only-editor";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";

const MUST_BE_AFTER = /Must be after/;

function makeEvent(occurredAt = "2026-04-10T14:00:00"): SessionEvent {
	return { id: "e1", eventType: "time", payload: {}, occurredAt };
}

describe("useTimeOnlyEditor", () => {
	it("seeds time from event.occurredAt", () => {
		const { result } = renderHook(() =>
			useTimeOnlyEditor({
				event: makeEvent("2026-04-10T14:30:00"),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onTimeUpdate: vi.fn(),
			})
		);
		expect(result.current.form.state.values.time).toBe("14:30");
	});

	it("calls onTimeUpdate with the computed timestamp on submit", async () => {
		const onTimeUpdate = vi.fn();
		const { result } = renderHook(() =>
			useTimeOnlyEditor({
				event: makeEvent("2026-04-10T14:00:00"),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onTimeUpdate,
			})
		);
		act(() => {
			result.current.form.setFieldValue("time", "15:00");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onTimeUpdate).toHaveBeenCalledTimes(1);
		expect(typeof onTimeUpdate.mock.calls[0][0]).toBe("number");
	});

	it("skips onTimeUpdate when time is empty (toOccurredAtTimestamp returns undefined)", async () => {
		const onTimeUpdate = vi.fn();
		const { result } = renderHook(() =>
			useTimeOnlyEditor({
				event: makeEvent(),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onTimeUpdate,
			})
		);
		act(() => {
			result.current.form.setFieldValue("time", "");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onTimeUpdate).not.toHaveBeenCalled();
	});

	it("timeValidator respects minTime", () => {
		const { result } = renderHook(() =>
			useTimeOnlyEditor({
				event: makeEvent("2026-04-10T14:00:00"),
				isLoading: false,
				maxTime: null,
				minTime: new Date("2026-04-10T14:00:00"),
				onTimeUpdate: vi.fn(),
			})
		);
		expect(result.current.timeValidator("13:00")).toMatch(MUST_BE_AFTER);
		expect(result.current.timeValidator("14:30")).toBeUndefined();
	});
});
