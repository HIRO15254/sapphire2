import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	useCashGameEndEditor,
	useTournamentEndEditor,
} from "@/features/live-sessions/components/event-editors/session-end-editor/use-session-end-editor";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";

function event(
	payload: Record<string, unknown>,
	occurredAt = "2026-04-10T22:00:00"
): SessionEvent {
	return { id: "e-end", eventType: "session_end", payload, occurredAt };
}

describe("useCashGameEndEditor", () => {
	it("defaults cashOutAmount to '0' when payload is empty", () => {
		const { result } = renderHook(() =>
			useCashGameEndEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.form.state.values.cashOutAmount).toBe("0");
	});

	it("seeds cashOutAmount from payload", () => {
		const { result } = renderHook(() =>
			useCashGameEndEditor({
				event: event({ cashOutAmount: 1500 }),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.form.state.values.cashOutAmount).toBe("1500");
	});

	it("submits numeric cashOutAmount with occurredAt timestamp", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useCashGameEndEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit,
			})
		);
		act(() => {
			result.current.form.setFieldValue("cashOutAmount", "2000");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			{ cashOutAmount: 2000 },
			expect.any(Number)
		);
	});

	it("rejects negative cashOutAmount", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useCashGameEndEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit,
			})
		);
		act(() => {
			result.current.form.setFieldValue("cashOutAmount", "-1");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});
});

describe("useTournamentEndEditor", () => {
	it("seeds all fields from payload, mapping beforeDeadline to boolean", () => {
		const { result } = renderHook(() =>
			useTournamentEndEditor({
				event: event({
					beforeDeadline: true,
					placement: 2,
					totalEntries: 40,
					prizeMoney: 1000,
					bountyPrizes: 25,
				}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.form.state.values).toMatchObject({
			beforeDeadline: true,
			placement: "2",
			totalEntries: "40",
			prizeMoney: "1000",
			bountyPrizes: "25",
		});
	});

	it("bountyPrizes falls back to '' when payload value is 0", () => {
		const { result } = renderHook(() =>
			useTournamentEndEditor({
				event: event({ bountyPrizes: 0 }),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.form.state.values.bountyPrizes).toBe("");
	});

	it("rejects submission when beforeDeadline=false and placement is missing", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTournamentEndEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit,
			})
		);
		act(() => {
			result.current.form.setFieldValue("totalEntries", "30");
			result.current.form.setFieldValue("prizeMoney", "500");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits full payload when beforeDeadline=false", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTournamentEndEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit,
			})
		);
		act(() => {
			result.current.form.setFieldValue("placement", "3");
			result.current.form.setFieldValue("totalEntries", "50");
			result.current.form.setFieldValue("prizeMoney", "800");
			result.current.form.setFieldValue("bountyPrizes", "50");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			{
				beforeDeadline: false,
				placement: 3,
				totalEntries: 50,
				prizeMoney: 800,
				bountyPrizes: 50,
			},
			expect.any(Number)
		);
	});

	it("submits without placement/totalEntries when beforeDeadline=true", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTournamentEndEditor({
				event: event({ beforeDeadline: true }),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit,
			})
		);
		act(() => {
			result.current.form.setFieldValue("prizeMoney", "300");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			{ beforeDeadline: true, prizeMoney: 300, bountyPrizes: 0 },
			expect.any(Number)
		);
	});
});
