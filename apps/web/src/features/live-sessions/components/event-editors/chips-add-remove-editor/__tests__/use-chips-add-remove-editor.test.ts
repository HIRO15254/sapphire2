import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useChipsAddRemoveEditor } from "@/features/live-sessions/components/event-editors/chips-add-remove-editor/use-chips-add-remove-editor";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";

const MUST_BE_AFTER = /Must be after/;
const MUST_BE_BEFORE = /Must be before/;

function event(
	payload: Record<string, unknown>,
	occurredAt = "2026-04-10T10:15:00"
): SessionEvent {
	return { id: "e1", eventType: "chips_add", payload, occurredAt };
}

describe("useChipsAddRemoveEditor", () => {
	it("defaults to amount '0' and type 'add' when payload is empty", () => {
		const { result } = renderHook(() =>
			useChipsAddRemoveEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.form.state.values).toEqual({
			time: "10:15",
			amount: "0",
			type: "add",
		});
	});

	it("seeds type='remove' when payload.amount is negative", () => {
		const { result } = renderHook(() =>
			useChipsAddRemoveEditor({
				event: event({ amount: -500 }),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.form.state.values.type).toBe("remove");
		expect(result.current.form.state.values.amount).toBe("500");
	});

	it("submits a negative amount when type is 'remove'", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useChipsAddRemoveEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit,
			})
		);
		act(() => {
			result.current.form.setFieldValue("amount", "250");
			result.current.form.setFieldValue("type", "remove");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({ amount: -250 }, expect.any(Number));
	});

	it("rejects submission when amount magnitude is zero", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useChipsAddRemoveEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit,
			})
		);
		act(() => {
			result.current.form.setFieldValue("amount", "0");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("timeValidator flags times outside [minTime, maxTime]", () => {
		const occurred = "2026-04-10T10:15:00";
		const minTime = new Date("2026-04-10T10:00:00");
		const maxTime = new Date("2026-04-10T11:00:00");
		const { result } = renderHook(() =>
			useChipsAddRemoveEditor({
				event: event({}, occurred),
				isLoading: false,
				maxTime,
				minTime,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.timeValidator("09:30")).toMatch(MUST_BE_AFTER);
		expect(result.current.timeValidator("11:30")).toMatch(MUST_BE_BEFORE);
		expect(result.current.timeValidator("10:30")).toBeUndefined();
	});
});
