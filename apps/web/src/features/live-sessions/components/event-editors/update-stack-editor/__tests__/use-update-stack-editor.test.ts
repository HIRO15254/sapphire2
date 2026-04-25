import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useUpdateStackEditor } from "@/features/live-sessions/components/event-editors/update-stack-editor/use-update-stack-editor";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";

const MUST_BE_AFTER = /Must be after/;
const MUST_BE_BEFORE = /Must be before/;

function event(
	payload: Record<string, unknown>,
	occurredAt = "2026-04-10T11:00:00"
): SessionEvent {
	return { id: "e1", eventType: "update_stack", payload, occurredAt };
}

describe("useUpdateStackEditor", () => {
	it("seeds stackAmount to '0' when payload is empty", () => {
		const { result } = renderHook(() =>
			useUpdateStackEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.form.state.values.stackAmount).toBe("0");
	});

	it("seeds stackAmount from payload (stringified)", () => {
		const { result } = renderHook(() =>
			useUpdateStackEditor({
				event: event({ stackAmount: 5000 }),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.form.state.values.stackAmount).toBe("5000");
	});

	it("rejects negative stackAmount", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useUpdateStackEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit,
			})
		);
		act(() => {
			result.current.form.setFieldValue("stackAmount", "-100");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits numeric stackAmount with a computed timestamp", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useUpdateStackEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit,
			})
		);
		act(() => {
			result.current.form.setFieldValue("stackAmount", "7500");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			{ stackAmount: 7500 },
			expect.any(Number)
		);
	});

	it("timeValidator respects min/max bounds", () => {
		const { result } = renderHook(() =>
			useUpdateStackEditor({
				event: event({}, "2026-04-10T11:00:00"),
				isLoading: false,
				maxTime: new Date("2026-04-10T12:00:00"),
				minTime: new Date("2026-04-10T10:00:00"),
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.timeValidator("09:30")).toMatch(MUST_BE_AFTER);
		expect(result.current.timeValidator("12:30")).toMatch(MUST_BE_BEFORE);
		expect(result.current.timeValidator("11:30")).toBeUndefined();
	});
});
