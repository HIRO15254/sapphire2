import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMemoEditor } from "@/features/live-sessions/components/event-editors/memo-editor/use-memo-editor";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";

const MUST_BE_AFTER = /Must be after/;
const MUST_BE_BEFORE = /Must be before/;

function event(
	payload: Record<string, unknown>,
	occurredAt = "2026-04-10T14:00:00"
): SessionEvent {
	return { id: "e1", eventType: "memo", payload, occurredAt };
}

describe("useMemoEditor", () => {
	it("defaults text to empty string when payload.text is absent", () => {
		const { result } = renderHook(() =>
			useMemoEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.form.state.values).toEqual({
			time: "14:00",
			text: "",
		});
	});

	it("seeds text from payload.text", () => {
		const { result } = renderHook(() =>
			useMemoEditor({
				event: event({ text: "player tilted" }),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.form.state.values.text).toBe("player tilted");
	});

	it("submits text and occurredAt timestamp", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useMemoEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit,
			})
		);
		act(() => {
			result.current.form.setFieldValue("text", "hello");
			result.current.form.setFieldValue("time", "15:00");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			{ text: "hello" },
			expect.any(Number)
		);
	});

	it("textValidator flags empty / whitespace-only input", () => {
		const { result } = renderHook(() =>
			useMemoEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.textValidator("")).toBe("Text is required");
		expect(result.current.textValidator("   ")).toBe("Text is required");
		expect(result.current.textValidator("note")).toBeUndefined();
	});

	it("timeValidator checks min/max time bounds", () => {
		const { result } = renderHook(() =>
			useMemoEditor({
				event: event({}, "2026-04-10T14:00:00"),
				isLoading: false,
				maxTime: new Date("2026-04-10T15:00:00"),
				minTime: new Date("2026-04-10T13:00:00"),
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.timeValidator("12:30")).toMatch(MUST_BE_AFTER);
		expect(result.current.timeValidator("15:30")).toMatch(MUST_BE_BEFORE);
	});
});
