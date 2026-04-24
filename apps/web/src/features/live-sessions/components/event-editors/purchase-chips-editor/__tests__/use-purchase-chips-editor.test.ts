import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePurchaseChipsEditor } from "@/features/live-sessions/components/event-editors/purchase-chips-editor/use-purchase-chips-editor";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";

const MUST_BE_AFTER = /Must be after/;
const MUST_BE_BEFORE = /Must be before/;

function event(
	payload: Record<string, unknown>,
	occurredAt = "2026-04-10T09:00:00"
): SessionEvent {
	return { id: "e1", eventType: "purchase_chips", payload, occurredAt };
}

describe("usePurchaseChipsEditor", () => {
	it("defaults all fields when payload is empty", () => {
		const { result } = renderHook(() =>
			usePurchaseChipsEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.form.state.values).toEqual({
			time: "09:00",
			name: "",
			cost: "0",
			chips: "0",
		});
	});

	it("seeds fields from payload", () => {
		const { result } = renderHook(() =>
			usePurchaseChipsEditor({
				event: event({ name: "Addon", cost: 20, chips: 3000 }),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.form.state.values).toMatchObject({
			name: "Addon",
			cost: "20",
			chips: "3000",
		});
	});

	it("rejects submission with empty name", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			usePurchaseChipsEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit,
			})
		);
		act(() => {
			result.current.form.setFieldValue("cost", "10");
			result.current.form.setFieldValue("chips", "100");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits rounded numeric cost/chips with occurredAt timestamp", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			usePurchaseChipsEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit,
			})
		);
		act(() => {
			result.current.form.setFieldValue("name", "Rebuy");
			result.current.form.setFieldValue("cost", "25");
			result.current.form.setFieldValue("chips", "4000");
			result.current.form.setFieldValue("time", "10:30");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			{ name: "Rebuy", cost: 25, chips: 4000 },
			expect.any(Number)
		);
	});

	it("timeValidator respects min/max bounds", () => {
		const { result } = renderHook(() =>
			usePurchaseChipsEditor({
				event: event({}, "2026-04-10T09:00:00"),
				isLoading: false,
				maxTime: new Date("2026-04-10T10:00:00"),
				minTime: new Date("2026-04-10T08:30:00"),
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.timeValidator("08:00")).toMatch(MUST_BE_AFTER);
		expect(result.current.timeValidator("11:00")).toMatch(MUST_BE_BEFORE);
		expect(result.current.timeValidator("09:30")).toBeUndefined();
	});
});
